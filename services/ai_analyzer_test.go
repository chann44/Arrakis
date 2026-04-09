package services

import "testing"

func TestRewriteDatabaseURLForDocker_RewritesLoopbackHost(t *testing.T) {
	input := "postgres://dev:dev@localhost:5432/app?sslmode=disable"
	got := rewriteDatabaseURLForDocker(input)
	want := "postgres://dev:dev@host.docker.internal:5432/app?sslmode=disable"
	if got != want {
		t.Fatalf("unexpected rewritten url\nwant: %s\n got: %s", want, got)
	}
}

func TestRewriteDatabaseURLForDocker_LeavesRemoteHostUntouched(t *testing.T) {
	input := "postgres://dev:dev@postgres:5432/app?sslmode=disable"
	got := rewriteDatabaseURLForDocker(input)
	if got != input {
		t.Fatalf("expected unchanged url\nwant: %s\n got: %s", input, got)
	}
}
