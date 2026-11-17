package main

import (
	"context"
	"errors"
	"helpdesk.local/m0/internal/bootstrap"
	"helpdesk.local/m0/internal/platform/config"
	"helpdesk.local/m0/internal/platform/database"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	if err := run(); err != nil {
		slog.Error("startup or runtime failure", "reason", err.Error())
		os.Exit(1)
	}
}
func run() error {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		client := http.Client{Timeout: 4 * time.Second}
		r, err := client.Get("http://127.0.0.1:8080/api/v1/health/ready")
		if err != nil {
			return errors.New("health unavailable")
		}
		defer r.Body.Close()
		if r.StatusCode != 200 {
			return errors.New("not ready")
		}
		return nil
	}
	if _, err := config.Load("/app/configs/M0.json"); err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	start, cancel := context.WithTimeout(ctx, 30*time.Second)
	pools, err := database.Open(start, "db", "/run/secrets")
	cancel()
	if err != nil {
		return err
	}
	defer pools.Close()
	if err := pools.Ready(ctx); err != nil {
		return err
	}
	options, err := bootstrap.LabOptions()
	if err != nil {
		return err
	}
	modules := bootstrap.Compose(pools)
	if len(modules) != 9 {
		return errors.New("module registry incomplete")
	}
	runtime := bootstrap.NewApplication(pools, options)
	runtime.Run(ctx)
	server := &http.Server{Addr: ":8080", Handler: runtime.Handler, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16384}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	slog.Info("helpdesk M0 started", "modules", len(modules), "environment", "synthetic_lab")
	select {
	case err := <-done:
		if !errors.Is(err, http.ErrServerClosed) {
			return err
		}
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
	return nil
}
