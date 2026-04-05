package jobs

import (
	"encoding/json"
	"fmt"

	"github.com/hibiken/asynq"
)

const TypeDependencySync = "dependencies:sync"

type DependencySyncPayload struct {
	SyncID  int64  `json:"sync_id"`
	UserID  int64  `json:"user_id"`
	RepoID  int64  `json:"repo_id"`
	Trigger string `json:"trigger"`
	Force   bool   `json:"force"`
}

func NewDependencySyncTask(payload DependencySyncPayload) (*asynq.Task, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal dependency sync payload: %w", err)
	}
	return asynq.NewTask(TypeDependencySync, body), nil
}

func ParseDependencySyncPayload(task *asynq.Task) (DependencySyncPayload, error) {
	var payload DependencySyncPayload
	if err := json.Unmarshal(task.Payload(), &payload); err != nil {
		return DependencySyncPayload{}, fmt.Errorf("unmarshal dependency sync payload: %w", err)
	}
	if payload.UserID == 0 || payload.RepoID == 0 {
		return DependencySyncPayload{}, fmt.Errorf("invalid dependency sync payload")
	}
	if payload.Trigger == "" {
		payload.Trigger = "manual"
	}
	return payload, nil
}
