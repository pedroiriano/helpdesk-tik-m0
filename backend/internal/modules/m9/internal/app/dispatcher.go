package app

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/smtp"
	"net/url"
	"strings"
	"time"

	"helpdesk.local/m0/internal/modules/m9/api"
	"helpdesk.local/m0/internal/modules/m9/internal/domain"
	"helpdesk.local/m0/internal/platform/web"
)

type DeliveryOptions struct {
	TelegramEnabled  bool
	TelegramBotToken string
	TelegramAPIBase  string
	SMTPEnabled      bool
	SMTPHost         string
	SMTPPort         int
	SMTPFrom         string
	SMTPUser         string
	SMTPPass         string
	SMTPUseTLS       bool
	ContactEmail     func(context.Context, string) (string, bool, error)
}

func validTelegramBase(raw string) (string, error) {
	base := strings.TrimRight(strings.TrimSpace(raw), "/")
	if base == "" {
		base = "https://api.telegram.org"
	}
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return "", errors.New("INVALID_TELEGRAM_BASE")
	}
	if u.Scheme == "https" || (u.Scheme == "http" && (u.Hostname() == "127.0.0.1" || u.Hostname() == "::1" || u.Hostname() == "localhost")) {
		return base, nil
	}
	return "", errors.New("INSECURE_TELEGRAM_SCHEME")
}

func (s *Service) dispatchTelegram(ctx context.Context, chatID, title string) error {
	if !s.Delivery.TelegramEnabled || strings.TrimSpace(s.Delivery.TelegramBotToken) == "" {
		return errors.New("TELEGRAM_DISABLED")
	}
	if strings.TrimSpace(chatID) == "" || domain.HasCRLF(chatID) {
		return errors.New("NO_ACTIVE_BINDING")
	}
	base, err := validTelegramBase(s.Delivery.TelegramAPIBase)
	if err != nil {
		return err
	}
	payload, err := json.Marshal(map[string]any{
		"chat_id": strings.TrimSpace(chatID),
		"text":    "[Helpdesk TIK Kota Depok] " + strings.TrimSpace(title),
	})
	if err != nil {
		return err
	}
	endpoint := fmt.Sprintf("%s/bot%s/sendMessage", base, s.Delivery.TelegramBotToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return errors.New("TELEGRAM_REQUEST_ERROR")
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return errors.New("TELEGRAM_UNAVAILABLE")
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("TELEGRAM_HTTP_%d", resp.StatusCode)
	}
	return nil
}

func (s *Service) dispatchEmail(ctx context.Context, recipientID, title string) error {
	if !s.Delivery.SMTPEnabled || strings.TrimSpace(s.Delivery.SMTPHost) == "" {
		return errors.New("SMTP_DISABLED")
	}
	if s.Delivery.ContactEmail == nil {
		return errors.New("CONTACT_LOOKUP_UNAVAILABLE")
	}
	toEmail, ok, err := s.Delivery.ContactEmail(ctx, recipientID)
	if err != nil {
		return errors.New("CONTACT_LOOKUP_FAILED")
	}
	if !ok || strings.TrimSpace(toEmail) == "" {
		return errors.New("NO_VERIFIED_EMAIL")
	}
	if domain.HasCRLF(toEmail) || domain.HasCRLF(s.Delivery.SMTPFrom) || domain.HasCRLF(title) {
		return errors.New("HEADER_INJECTION_REJECTED")
	}
	port := s.Delivery.SMTPPort
	if port <= 0 {
		port = 587
	}
	addr := net.JoinHostPort(s.Delivery.SMTPHost, fmt.Sprintf("%d", port))
	from := strings.TrimSpace(s.Delivery.SMTPFrom)
	if from == "" {
		from = "noreply@helpdesk.depok.go.id"
	}
	subject := strings.ReplaceAll(strings.TrimSpace(title), "\n", " ")
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: [Helpdesk TIK Depok] %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s\r\n", from, toEmail, subject, subject))

	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return errors.New("SMTP_UNAVAILABLE")
	}
	c, err := smtp.NewClient(conn, s.Delivery.SMTPHost)
	if err != nil {
		_ = conn.Close()
		return errors.New("SMTP_HANDSHAKE_FAILED")
	}
	defer c.Close()

	if s.Delivery.SMTPUseTLS {
		if okTLS, _ := c.Extension("STARTTLS"); okTLS {
			if err := c.StartTLS(&tls.Config{ServerName: s.Delivery.SMTPHost, MinVersion: tls.VersionTLS12}); err != nil {
				return errors.New("SMTP_STARTTLS_FAILED")
			}
		}
	}
	if s.Delivery.SMTPUser != "" {
		auth := smtp.PlainAuth("", s.Delivery.SMTPUser, s.Delivery.SMTPPass, s.Delivery.SMTPHost)
		if err := c.Auth(auth); err != nil {
			return errors.New("SMTP_AUTH_FAILED")
		}
	}
	if err := c.Mail(from); err != nil {
		return errors.New("SMTP_MAIL_FAILED")
	}
	if err := c.Rcpt(toEmail); err != nil {
		return errors.New("SMTP_RCPT_FAILED")
	}
	wc, err := c.Data()
	if err != nil {
		return errors.New("SMTP_DATA_FAILED")
	}
	if _, err := wc.Write(msg); err != nil {
		_ = wc.Close()
		return errors.New("SMTP_WRITE_FAILED")
	}
	if err := wc.Close(); err != nil {
		return errors.New("SMTP_COMMIT_FAILED")
	}
	_ = c.Quit()
	return nil
}

func deliveryBackoff(attempt int) time.Duration {
	switch attempt {
	case 1:
		return time.Second
	case 2:
		return 5 * time.Second
	case 3:
		return 15 * time.Second
	default:
		return 60 * time.Second
	}
}

// ProcessDeliveryBatch executes one bounded pass of due Telegram/Email notification deliveries.
func (s *Service) ProcessDeliveryBatch(ctx context.Context, limit int) (int, error) {
	jobs, err := s.store.ClaimDueDeliveryJobs(ctx, limit)
	if err != nil {
		return 0, err
	}
	processed := 0
	for _, job := range jobs {
		var sendErr error
		stepCtx, cancel := context.WithTimeout(ctx, 6*time.Second)
		switch job.Channel {
		case "TELEGRAM":
			sendErr = s.dispatchTelegram(stepCtx, job.TargetChatID, job.Title)
		case "EMAIL":
			sendErr = s.dispatchEmail(stepCtx, job.RecipientID, job.Title)
		default:
			sendErr = errors.New("UNSUPPORTED_CHANNEL")
		}
		cancel()

		now := time.Now().UTC()
		if sendErr == nil {
			if err := s.store.FinishDeliveryJob(ctx, job.ID, "ACKED", "", now); err != nil {
				return processed, err
			}
		} else {
			code := domain.SanitizeErrorCode(sendErr, s.Delivery.TelegramBotToken, s.Delivery.SMTPPass)
			state := "FAILED"
			nextTry := now.Add(deliveryBackoff(job.Attempts))
			if job.Attempts >= 5 {
				state = "DEAD_LETTER"
			}
			if err := s.store.FinishDeliveryJob(ctx, job.ID, state, code, nextTry); err != nil {
				return processed, err
			}
		}
		processed++
	}
	return processed, nil
}

func (s *Service) RunDispatcher(ctx context.Context) {
	if s.Lab && !s.Delivery.TelegramEnabled && !s.Delivery.SMTPEnabled {
		return
	}
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			_, _ = s.ProcessDeliveryBatch(ctx, 20)
		}
	}
}

func (s *Service) ListDeliveryJobs(ctx context.Context, stateFilter string, limit int) ([]api.DeliveryJobRecord, error) {
	rows, err := s.store.ListDeliveryJobs(ctx, stateFilter, limit)
	if err != nil {
		return nil, err
	}
	out := make([]api.DeliveryJobRecord, 0, len(rows))
	for _, row := range rows {
		rec := row.Record
		if rec.TargetMasked == "" && rec.Channel == "EMAIL" && s.Delivery.ContactEmail != nil {
			if email, ok, err := s.Delivery.ContactEmail(ctx, row.RecipientID); err == nil && ok {
				rec.TargetMasked = domain.MaskEmail(email)
			}
		}
		if rec.TargetMasked == "" {
			rec.TargetMasked = "***"
		}
		out = append(out, rec)
	}
	return out, nil
}

func (s *Service) ReplayDeliveryJob(ctx context.Context, id, actorID, reason string, expectedVersion int64) (*api.DeliveryJobRecord, error) {
	trimmed := strings.TrimSpace(reason)
	if trimmed == "" || len(trimmed) > 500 || expectedVersion < 1 {
		return nil, web.Fail(422, "Versi dan alasan replay wajib diisi")
	}
	return s.store.ReplayDeliveryJob(ctx, id, actorID, trimmed, expectedVersion)
}
