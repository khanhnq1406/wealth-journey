package scheduler

import (
	"context"
	"time"

	"wealthjourney/pkg/database"
	"wealthjourney/pkg/jobs"
	"wealthjourney/pkg/redis"
)

// SessionCleanupJobAdapter wraps the existing jobs.SessionCleanupJob
// to implement the scheduler.Job interface.
type SessionCleanupJobAdapter struct {
	inner *jobs.SessionCleanupJob
}

func NewSessionCleanupJobAdapter(db *database.Database, rdb *redis.RedisClient) *SessionCleanupJobAdapter {
	return &SessionCleanupJobAdapter{
		inner: jobs.NewSessionCleanupJob(db, rdb),
	}
}

func (j *SessionCleanupJobAdapter) Name() string              { return "session-cleanup" }
func (j *SessionCleanupJobAdapter) Interval() time.Duration   { return 6 * time.Hour }
func (j *SessionCleanupJobAdapter) StartupDelay() time.Duration { return 5 * time.Second }

func (j *SessionCleanupJobAdapter) Run(ctx context.Context) error {
	return j.inner.Run(ctx)
}
