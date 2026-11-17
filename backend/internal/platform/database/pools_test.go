package database

import (
	"context"
	"os"
	"testing"
	"time"
)

func TestOwnerIsolation(t *testing.T) {
	if os.Getenv("HELPDESK_DB_TEST") != "1" {
		t.Skip("NOT_RUN: opt-in requires isolated local DB")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	pools, err := Open(ctx, "db", "/run/secrets")
	if err != nil {
		t.Fatal(err)
	}
	defer pools.Close()
	for i, pool := range pools {
		if pool.Config().MaxConns != 4 {
			t.Fatal("pool budget drift")
		}
		for j, schema := range Schemas {
			_, err := pool.Exec(ctx, "SELECT version FROM "+schema+".schema_version")
			if (i == j) != (err == nil) {
				t.Fatalf("owner isolation violation: m%d schema %s", i+1, schema)
			}
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		_, err = tx.Exec(ctx, "CREATE TABLE "+Schemas[i]+".forbidden_ddl (id int)")
		_ = tx.Rollback(ctx)
		if err == nil {
			t.Fatal("runtime role can execute DDL")
		}
		tx, err = pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		_, err = tx.Exec(ctx, "UPDATE "+Schemas[i]+".schema_version SET version = 2")
		_ = tx.Rollback(ctx)
		if err == nil {
			t.Fatal("runtime can modify migration marker")
		}
	}
	if pools.Ready(ctx) != nil {
		t.Fatal("readiness failed")
	}
}
