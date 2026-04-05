package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/chann44/TGE/adapters"
	internal "github.com/chann44/TGE/internals"
	db "github.com/chann44/TGE/internals/db"
	"github.com/chann44/TGE/internals/jobs"
	"github.com/chann44/TGE/services"
	"github.com/hibiken/asynq"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := internal.GetConfig()

	postgresPool, err := adapters.NewPostgres(ctx, cfg)
	if err != nil {
		log.Fatalf("worker: failed to initialize postgres: %v", err)
	}
	defer postgresPool.Close()

	queries := db.New(postgresPool)
	redisAddr := fmt.Sprintf("%s:%s", cfg.RedisHost, cfg.RedisPort)

	srv := asynq.NewServer(
		asynq.RedisClientOpt{Addr: redisAddr},
		asynq.Config{
			Concurrency: 4,
			Queues: map[string]int{
				"dependencies": 10,
			},
		},
	)

	mux := asynq.NewServeMux()
	mux.HandleFunc(jobs.TypeDependencySync, func(ctx context.Context, task *asynq.Task) error {
		payload, err := jobs.ParseDependencySyncPayload(task)
		if err != nil {
			return fmt.Errorf("parse payload: %w", asynq.SkipRetry)
		}
		if err := services.SyncRepositoryDependencies(ctx, queries, cfg, payload.UserID, payload.RepoID, payload.Trigger); err != nil {
			return err
		}
		return nil
	})

	errCh := make(chan error, 1)
	go func() {
		log.Printf("worker listening on queue dependencies")
		if runErr := srv.Run(mux); runErr != nil {
			errCh <- runErr
		}
	}()

	select {
	case <-ctx.Done():
		log.Println("worker: shutdown signal received")
		srv.Shutdown()
	case runErr := <-errCh:
		log.Fatalf("worker: server error: %v", runErr)
	}
}
