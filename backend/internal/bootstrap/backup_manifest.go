package bootstrap

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	identity "helpdesk.local/m0/internal/modules/m1/api"
	"helpdesk.local/m0/internal/platform/blob"
	"helpdesk.local/m0/internal/platform/database"
	"helpdesk.local/m0/internal/platform/web"
)

type ownerBackupSummary struct {
	Schema     string           `json:"schema"`
	SchemaVer  int              `json:"schema_version"`
	Counts     map[string]int64 `json:"counts"`
	DigestHex  string           `json:"digest_sha256,omitempty"`
	Truncated  bool             `json:"truncated,omitempty"`
	LatestTime *time.Time       `json:"latest_timestamp,omitempty"`
}

type storageIntegritySummary struct {
	BlobsChecked    int64 `json:"blobs_checked"`
	BlobsVerified   int64 `json:"blobs_verified"`
	BlobsMissing    int64 `json:"blobs_missing"`
	BlobsMismatched int64 `json:"blobs_mismatched"`
	Truncated       bool  `json:"truncated,omitempty"`
}

type backupBlobRecord struct {
	Owner  string `json:"owner"`
	ID     string `json:"id"`
	Status string `json:"status"`
	Size   int64  `json:"size_bytes"`
	SHA256 string `json:"sha256"`
}

type backupManifestArtifact struct {
	ManifestVersion     int                           `json:"manifest_version"`
	JobID               string                        `json:"job_id"`
	JobVersion          int64                         `json:"job_version"`
	TargetOrgID         string                        `json:"target_id"`
	ExecutedBy          string                        `json:"executed_by"`
	ExecutedAt          time.Time                     `json:"executed_at"`
	ConfigSHA256        string                        `json:"config_sha256"`
	MigrationManifest   string                        `json:"migration_manifest_sha256"`
	MigrationChecksums  string                        `json:"migration_checksums_sha256"`
	MigrationCount      int                           `json:"migration_count"`
	Owners              map[string]ownerBackupSummary `json:"owners"`
	StorageIntegrity    storageIntegritySummary       `json:"storage_integrity"`
	BlobMetadataRecords []backupBlobRecord            `json:"blob_metadata_records"`
}

func readAllowlistedFile(candidates ...string) ([]byte, string) {
	for _, path := range candidates {
		data, err := os.ReadFile(path)
		if err == nil && len(data) > 0 {
			return data, blob.Checksum(data)
		}
	}
	return nil, "UNAVAILABLE"
}

func backupManifestRunner(pools database.Pools, root string) identity.BackupManifestRunner {
	slots := make(chan struct{}, 2)
	files := blob.Files{Root: root}

	return identity.BackupManifestRunner{
		Execute: func(ctx context.Context, targetID, jobID, actorID string, version int64) (json.RawMessage, error) {
			if !web.UUID(targetID) || !web.UUID(jobID) || !web.UUID(actorID) {
				return nil, web.Fail(400, "Identitas pekerjaan manifest tidak valid")
			}
			select {
			case slots <- struct{}{}:
				defer func() { <-slots }()
			default:
				return nil, web.Fail(503, "Runner manifest sedang sibuk")
			}

			now := time.Now().UTC()
			_, cfgSHA := readAllowlistedFile("/app/configs/M0.json", "configs/M0.json", "../../../configs/M0.json")
			migRaw, migSHA := readAllowlistedFile("/app/migrations/manifest.json", "migrations/manifest.json", "../../../migrations/manifest.json")
			_, chkSHA := readAllowlistedFile("/app/migrations/checksums.sha256", "migrations/checksums.sha256", "../../../migrations/checksums.sha256")
			migCount := 0
			if len(migRaw) > 0 {
				var parsed struct {
					Migrations []json.RawMessage `json:"migrations"`
				}
				if json.Unmarshal(migRaw, &parsed) == nil {
					migCount = len(parsed.Migrations)
				}
			}

			owners, blobs, integrity, err := collectOwnerBackupMetadata(ctx, pools, files)
			if err != nil {
				return nil, err
			}

			artifact := backupManifestArtifact{
				ManifestVersion:     1,
				JobID:               jobID,
				JobVersion:          version,
				TargetOrgID:         targetID,
				ExecutedBy:          actorID,
				ExecutedAt:          now,
				ConfigSHA256:        cfgSHA,
				MigrationManifest:   migSHA,
				MigrationChecksums:  chkSHA,
				MigrationCount:      migCount,
				Owners:              owners,
				StorageIntegrity:    integrity,
				BlobMetadataRecords: blobs,
			}
			rawArtifact, err := json.MarshalIndent(artifact, "", "  ")
			if err != nil {
				return nil, err
			}
			manifestSHA := blob.Checksum(rawArtifact)

			if err := files.PutManifest(ctx, jobID, rawArtifact); err != nil {
				return nil, err
			}
			readback, err := files.ReadManifest(jobID)
			if err != nil || blob.Checksum(readback) != manifestSHA {
				return nil, errors.New("verifikasi tulis-baca artefak manifest gagal")
			}

			ownerDigest := make(map[string]map[string]any, len(owners))
			for k, v := range owners {
				ownerDigest[k] = map[string]any{
					"schema":         v.Schema,
					"schema_version": v.SchemaVer,
					"counts":         v.Counts,
				}
				if v.DigestHex != "" {
					ownerDigest[k]["digest_sha256"] = v.DigestHex
				}
			}

			receipt := map[string]any{
				"status":                     "SUCCEEDED",
				"artifact_key":               "manifests/" + jobID + ".json",
				"manifest_sha256":            manifestSHA,
				"artifact_bytes":             len(rawArtifact),
				"executed_by":                actorID,
				"executed_at":                now,
				"config_sha256":              cfgSHA,
				"migration_manifest_sha256":  migSHA,
				"migration_checksums_sha256": chkSHA,
				"migration_count":            migCount,
				"owners":                     ownerDigest,
				"storage_integrity":          integrity,
			}
			return json.Marshal(receipt)
		},

		ReadArtifact: func(_ context.Context, jobID string, receipt json.RawMessage) (identity.BackupManifestArtifact, error) {
			var parsed struct {
				ManifestSHA256 string `json:"manifest_sha256"`
			}
			if err := json.Unmarshal(receipt, &parsed); err != nil || parsed.ManifestSHA256 == "" {
				return identity.BackupManifestArtifact{}, web.Fail(409, "Tanda terima checksum manifest tidak tersedia")
			}
			data, err := files.ReadManifest(jobID)
			if err != nil {
				if os.IsNotExist(err) {
					return identity.BackupManifestArtifact{}, web.Fail(404, "Berkas artefak manifest tidak ditemukan di storage")
				}
				return identity.BackupManifestArtifact{}, err
			}
			actualSHA := blob.Checksum(data)
			if actualSHA != parsed.ManifestSHA256 {
				return identity.BackupManifestArtifact{}, web.Fail(500, "Integritas SHA-256 artefak manifest tidak cocok")
			}
			return identity.BackupManifestArtifact{Payload: data, SHA256: actualSHA}, nil
		},
	}
}

func collectOwnerBackupMetadata(ctx context.Context, pools database.Pools, files blob.Files) (map[string]ownerBackupSummary, []backupBlobRecord, storageIntegritySummary, error) {
	owners := make(map[string]ownerBackupSummary, 9)
	var allBlobs []backupBlobRecord
	var integrity storageIntegritySummary

	type simpleQuery struct {
		ownerIdx int
		moduleID string
		schema   string
		counts   map[string]string
	}
	specs := []simpleQuery{
		{0, "M1", "identity", map[string]string{
			"organizations_active":      "SELECT count(*) FROM identity.organizations WHERE active",
			"subjects_active":           "SELECT count(*) FROM identity.subjects WHERE active",
			"memberships_active":        "SELECT count(*) FROM identity.memberships WHERE revoked_at IS NULL AND valid_until > now()",
			"system_operation_requests": "SELECT count(*) FROM identity.system_operation_requests",
		}},
		{1, "M2", "catalog", map[string]string{
			"services_active":   "SELECT count(*) FROM catalog.services WHERE active",
			"service_forms":     "SELECT count(*) FROM catalog.service_forms",
			"policies":          "SELECT count(*) FROM catalog.policies",
			"portal_navigation": "SELECT count(*) FROM catalog.portal_navigation",
		}},
		{2, "M3", "intake", map[string]string{
			"tickets":               "SELECT count(*) FROM intake.tickets",
			"resolution_attempts":   "SELECT count(*) FROM intake.resolution_attempts",
			"outbox_pending":        "SELECT count(*) FROM intake.outbox_delivery WHERE state IN ('PENDING','LEASED')",
			"outbox_dead_letters":   "SELECT count(*) FROM intake.outbox_delivery WHERE state='DEAD_LETTER'",
			"attachments_clean":     "SELECT count(*) FROM intake.attachments WHERE status='CLEAN'",
			"attachments_quarantine": "SELECT count(*) FROM intake.attachments WHERE status='QUARANTINED'",
		}},
		{3, "M4", "classification", map[string]string{
			"rules_active":             "SELECT count(*) FROM classification.rules WHERE active",
			"classification_proposals": "SELECT count(*) FROM classification.classification_proposals",
		}},
		{4, "M5", "assignment", map[string]string{
			"routing_rules_active": "SELECT count(*) FROM assignment.routing_rules WHERE active",
			"rosters":              "SELECT count(*) FROM assignment.rosters",
			"assignment_proposals": "SELECT count(*) FROM assignment.assignment_proposals",
		}},
		{5, "M6", "sla", map[string]string{
			"calendars": "SELECT count(*) FROM sla.calendars",
			"holidays":  "SELECT count(*) FROM sla.holidays",
			"targets":   "SELECT count(*) FROM sla.targets",
		}},
		{6, "M7", "escalation", map[string]string{
			"rules_active":     "SELECT count(*) FROM escalation.rules WHERE active",
			"jobs_pending":     "SELECT count(*) FROM escalation.jobs WHERE state IN ('PENDING','LEASED')",
			"jobs_dead_letter": "SELECT count(*) FROM escalation.jobs WHERE state='DEAD_LETTER'",
		}},
		{7, "M8", "knowledge", map[string]string{
			"content_published": "SELECT count(*) FROM knowledge.content WHERE state='PUBLISHED'",
			"revisions":         "SELECT count(*) FROM knowledge.revisions",
			"media_clean":       "SELECT count(*) FROM knowledge.media WHERE status='CLEAN'",
			"media_quarantine":  "SELECT count(*) FROM knowledge.media WHERE status='QUARANTINED'",
		}},
		{8, "M9", "notify_audit", map[string]string{
			"notifications": "SELECT count(*) FROM notify_audit.notifications",
			"delivery_jobs": "SELECT count(*) FROM notify_audit.delivery_jobs",
			"audit_entries": "SELECT count(*) FROM notify_audit.audit_entries",
			"export_jobs":   "SELECT count(*) FROM notify_audit.export_jobs",
			"report_facts":  "SELECT count(*) FROM notify_audit.report_facts",
		}},
	}

	const maxBlobInspect = 5000
	checkedBlobs := 0

	for _, sp := range specs {
		pool := pools[sp.ownerIdx]
		if pool == nil {
			return nil, nil, integrity, fmt.Errorf("owner pool %s unavailable", sp.moduleID)
		}
		var schemaVer int
		if err := pool.QueryRow(ctx, "SELECT version FROM "+sp.schema+".schema_version WHERE singleton=true").Scan(&schemaVer); err != nil {
			return nil, nil, integrity, err
		}
		counts := make(map[string]int64, len(sp.counts))
		for metric, q := range sp.counts {
			var n int64
			if err := pool.QueryRow(ctx, q).Scan(&n); err != nil {
				return nil, nil, integrity, err
			}
			counts[metric] = n
		}
		summary := ownerBackupSummary{Schema: sp.schema, SchemaVer: schemaVer, Counts: counts}

		if sp.moduleID == "M9" {
			var latest *time.Time
			if err := pool.QueryRow(ctx, "SELECT max(created_at) FROM notify_audit.audit_entries").Scan(&latest); err == nil {
				summary.LatestTime = latest
			}
		}

		if sp.moduleID == "M3" || sp.moduleID == "M8" {
			table := "intake.attachments"
			if sp.moduleID == "M8" {
				table = "knowledge.media"
			}
			rows, err := pool.Query(ctx, "SELECT id::text,storage_key,status,size_bytes,encode(sha256,'hex') FROM "+table+" ORDER BY id ASC LIMIT $1", maxBlobInspect+1)
			if err != nil {
				return nil, nil, integrity, err
			}
			h := sha256.New()
			seen := 0
			for rows.Next() {
				var id, key, status, shaHex string
				var size int64
				if err := rows.Scan(&id, &key, &status, &size, &shaHex); err != nil {
					rows.Close()
					return nil, nil, integrity, err
				}
				seen++
				if seen > maxBlobInspect {
					summary.Truncated = true
					integrity.Truncated = true
					break
				}
				fmt.Fprintf(h, "%s|%s|%s|%d|%s\n", id, key, status, size, shaHex)
				allBlobs = append(allBlobs, backupBlobRecord{
					Owner:  sp.moduleID,
					ID:     id,
					Status: status,
					Size:   size,
					SHA256: shaHex,
				})
				if (status == "CLEAN" || status == "QUARANTINED") && checkedBlobs < maxBlobInspect {
					checkedBlobs++
					integrity.BlobsChecked++
					ok, missing, verifyErr := files.VerifySHA256(key, shaHex)
					if verifyErr != nil {
						rows.Close()
						return nil, nil, integrity, verifyErr
					}
					if missing {
						integrity.BlobsMissing++
					} else if ok {
						integrity.BlobsVerified++
					} else {
						integrity.BlobsMismatched++
					}
				}
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return nil, nil, integrity, err
			}
			rows.Close()
			summary.DigestHex = hex.EncodeToString(h.Sum(nil))
		}

		owners[sp.moduleID] = summary
	}

	return owners, allBlobs, integrity, nil
}
