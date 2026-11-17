package app

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	m1 "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/modules/m5/api"
	"helpdesk.local/m0/internal/modules/m5/internal/domain"
	"helpdesk.local/m0/internal/modules/m5/internal/store"
	"helpdesk.local/m0/internal/platform/delivery"
	"helpdesk.local/m0/internal/platform/web"
	"sort"
)

type Service struct {
	Store    store.Store
	Identity m1.Port
}

func (s *Service) Propose(ctx context.Context, ticketID string, ticketVersion int64, serviceID, org, level, category string) (api.Proposal, error) {
	level, err := domain.ValidateLevel(level)
	if err != nil {
		return api.Proposal{}, err
	}
	result := api.Proposal{TicketID: ticketID, TicketVersion: ticketVersion, Level: level, Status: "MANUAL", Candidates: []api.Candidate{}, Explanation: "Belum ada teknisi yang memenuhi aturan. Tinjau routing, skill dan roster."}
	rule, err := s.Store.FindRule(ctx, serviceID, level, category)
	var failure *web.Error
	if category != "" && ((errors.As(err, &failure) && failure.Status == 404) ||
		(err == nil && !rule.Active)) {
		rule, err = s.Store.FindRule(ctx, serviceID, level, "")
	}
	if errors.As(err, &failure) && failure.Status == 404 {
		return result, nil
	}
	if err != nil {
		return api.Proposal{}, err
	}
	if !rule.Active {
		return result, nil
	}
	target := org
	if rule.TargetOrgID != "" {
		target = rule.TargetOrgID
	}
	result.Destination, err = s.Identity.RoutingDestination(ctx, rule.TeamID, target)
	if err != nil || result.Destination == "" {
		return result, err
	}
	result.TeamID = rule.TeamID
	if target != org {
		result.Status = "HANDOFF"
		result.TeamID, result.TargetOrgID = rule.TeamID, target
		result.Explanation = "Kategori terverifikasi cocok dengan tim OPD lain. Ajukan pelimpahan agar tim tujuan dapat menerima."
		return result, nil
	}
	rosters, err := s.Store.EligibleRosters(ctx, rule.TeamID, org, rule.RequiredSkills)
	if err != nil {
		return api.Proposal{}, err
	}
	seen := map[string]bool{}
	for _, roster := range rosters {
		if seen[roster.SubjectID] {
			continue
		}
		actor, err := s.Identity.Access(ctx, roster.SubjectID)
		if errors.As(err, &failure) && failure.Status == 404 {
			continue
		}
		if err != nil {
			return api.Proposal{}, err
		}
		if actor.Kind != "STAFF" || actor.Role != "TECHNICIAN" || !actor.Can("ticket.read", org) || !actor.Can("ticket.resolve", org) {
			continue
		}
		teamEligible := false
		for _, membership := range actor.Memberships {
			if membership.OrganizationActive && membership.OrganizationID == org && (membership.TeamID == nil || *membership.TeamID == rule.TeamID) {
				teamEligible = true
				break
			}
		}
		if !teamEligible {
			continue
		}
		seen[roster.SubjectID] = true
		result.Candidates = append(result.Candidates, api.Candidate{Roster: roster, Name: actor.Name})
	}
	if len(result.Candidates) == 0 {
		return result, nil
	}
	preferred := result.Candidates[0].Roster
	result.Status = "RECOMMENDED"
	result.TeamID, result.AssigneeID, result.ProjectionAsOf = rule.TeamID, preferred.SubjectID, preferred.ProjectionAsOf
	result.Explanation = fmt.Sprintf("Routing %s, skill dan roster cocok. Beban terproyeksi %d tiket aktif. Ini saran, bukan reservasi kapasitas.", level, preferred.ActiveTickets)
	if rule.CategoryID != "" {
		result.Explanation = "Aturan kategori terverifikasi. " + result.Explanation
	}
	// Load and timestamps change asynchronously; fingerprint binds eligibility and the recommended person.
	entries := make([]api.RosterEntry, 0, len(result.Candidates))
	for _, c := range result.Candidates {
		roster := c.Roster
		roster.ActiveTickets = 0
		roster.ProjectionAsOf = nil
		entries = append(entries, roster)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].ID < entries[j].ID })
	raw, err := json.Marshal([]any{ticketID, ticketVersion, org, rule, preferred.SubjectID, entries})
	if err != nil {
		return api.Proposal{}, err
	}
	sum := sha256.Sum256(raw)
	result.Digest = hex.EncodeToString(sum[:])
	return result, nil
}

func (s *Service) ListTechnicians(ctx context.Context, teamID string) ([]api.Technician, error) {
	rosters, err := s.Store.ListRosterTechnicians(ctx, teamID)
	if err != nil {
		return nil, err
	}
	var out []api.Technician
	seen := make(map[string]bool)
	for _, r := range rosters {
		if seen[r.SubjectID] {
			continue
		}
		seen[r.SubjectID] = true
		subject, err := s.Identity.Subject(ctx, r.SubjectID)
		name := r.SubjectID
		if err == nil && subject.Name != "" {
			name = subject.Name
		}
		level := "L1"
		for _, sk := range r.Skills {
			if sk == "system" || sk == "security" {
				level = "L2"
				break
			}
		}
		out = append(out, api.Technician{
			ID:     r.SubjectID,
			Name:   name,
			TeamID: r.TeamID,
			Level:  level,
			Skills: r.Skills,
		})
	}
	return out, nil
}

func (s *Service) Consume(ctx context.Context, v delivery.Event) error {
	hash, err := delivery.Digest(v.Payload)
	if err != nil || !hmac.Equal(hash, v.Digest) || !web.UUID(v.ID) || !web.UUID(v.Aggregate) || v.Version < 1 || v.SchemaVersion != 1 {
		return delivery.ErrIntegrity
	}
	valid := (v.Type == "HandoffAccepted" || v.Type == "TicketCreated" || v.Type == "TicketStateChanged") && v.Producer == "M3"
	if !valid {
		return delivery.ErrIntegrity
	}
	tx, err := s.Store.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	_, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, v.ID)
	if err != nil {
		return err
	}
	var old []byte
	var oldAggregate string
	var oldVersion int64
	err = tx.QueryRow(ctx, `SELECT digest, aggregate_id::text, aggregate_version FROM assignment.inbox WHERE consumer_id='M5' AND event_id=$1`, v.ID).Scan(&old, &oldAggregate, &oldVersion)
	if err == nil {
		if !hmac.Equal(old, v.Digest) || oldAggregate != v.Aggregate || oldVersion != v.Version {
			return delivery.ErrIntegrity
		}
		return tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	err = nil
	switch v.Type {
	case "TicketCreated", "TicketStateChanged":
		var snapshot struct {
			State    string            `json:"state"`
			Assignee *string           `json:"assignee_id"`
			Org      string            `json:"service_owner_org_id"`
			Dispatch *api.DispatchFact `json:"dispatch,omitempty"`
		}
		if json.Unmarshal(v.Payload, &snapshot) != nil || !validTicketState(snapshot.State) || !web.UUID(snapshot.Org) || (snapshot.Assignee != nil && !web.UUID(*snapshot.Assignee)) {
			return delivery.ErrIntegrity
		}
		if snapshot.Dispatch != nil {
			f := snapshot.Dispatch
			digest, decodeErr := hex.DecodeString(f.ProposalDigest)
			if (snapshot.State != "ASSIGNED" && snapshot.State != "IN_PROGRESS") || snapshot.Assignee == nil || *snapshot.Assignee != f.AssigneeID || !web.UUID(f.TeamID) || !web.UUID(f.RecommendedAssigneeID) || decodeErr != nil || len(digest) != sha256.Size || (f.Tier != "L1" && f.Tier != "L2") {
				return delivery.ErrIntegrity
			}
			_, err = tx.Exec(ctx, `INSERT INTO assignment.assignment_proposals(id,ticket_id,ticket_version,assignee_id,team_id,explanation,tier,proposal_digest,recommended_assignee_id)
               VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, v.ID, v.Aggregate, v.Version, f.AssigneeID, f.TeamID, f.Explanation, f.Tier, f.ProposalDigest, f.RecommendedAssigneeID)
			if err != nil {
				return err
			}
		}
		_, err = tx.Exec(ctx, `INSERT INTO assignment.load_projection(id,ticket_id,source_version,assignee_id,state,updated_at,service_owner_org_id)
          VALUES($1,$2,$3,$4,$5,$6,$7)
          ON CONFLICT(ticket_id) DO UPDATE SET source_version=EXCLUDED.source_version,
            assignee_id=EXCLUDED.assignee_id,state=EXCLUDED.state,updated_at=EXCLUDED.updated_at,service_owner_org_id=EXCLUDED.service_owner_org_id
          WHERE assignment.load_projection.source_version<EXCLUDED.source_version
             OR (assignment.load_projection.service_owner_org_id IS NULL AND assignment.load_projection.source_version=EXCLUDED.source_version)`,
			web.ID(), v.Aggregate, v.Version, snapshot.Assignee, snapshot.State, v.Occurred, snapshot.Org)
	}
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO assignment.inbox(consumer_id, event_id, digest, aggregate_id, aggregate_version) VALUES('M5', $1, $2, $3, $4)`, v.ID, v.Digest, v.Aggregate, v.Version)
	if err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func validTicketState(state string) bool {
	switch state {
	case "OPEN", "TRIAGED", "NEEDS_INFORMATION", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED":
		return true
	default:
		return false
	}
}
