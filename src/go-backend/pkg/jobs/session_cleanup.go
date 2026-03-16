package jobs

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/redis"
)

// SessionCleanupJob cleans up expired sessions from database and Redis
type SessionCleanupJob struct {
	db  *database.Database
	rdb *redis.RedisClient
}

// NewSessionCleanupJob creates a new session cleanup job
func NewSessionCleanupJob(db *database.Database, rdb *redis.RedisClient) *SessionCleanupJob {
	return &SessionCleanupJob{
		db:  db,
		rdb: rdb,
	}
}

// Run executes the cleanup job
func (j *SessionCleanupJob) Run(ctx context.Context) error {
	log.Println("[JOB] Starting session cleanup...")

	// Find expired sessions in database
	var expiredSessions []models.Session
	if err := j.db.DB.Where("expires_at < ?", time.Now()).Find(&expiredSessions).Error; err != nil {
		log.Printf("[JOB] Error finding expired sessions: %v", err)
		return err
	}

	if len(expiredSessions) == 0 {
		log.Println("[JOB] No expired sessions to clean")
		return nil
	}

	log.Printf("[JOB] Found %d expired sessions to clean", len(expiredSessions))

	// Clean up each expired session
	cleanedCount := 0
	for _, session := range expiredSessions {
		// Get user to find email for Redis session key
		var user models.User
		if err := j.db.DB.First(&user, session.UserID).Error; err != nil {
			log.Printf("[JOB] Error finding user for session %s: %v", session.SessionID, err)
			continue
		}

		// Remove from Redis (use empty string for password-only users with nil email)
		email := ""
		if user.Email != nil {
			email = *user.Email
		}
		if err := j.rdb.RemoveSession(email, session.SessionID); err != nil {
			log.Printf("[JOB] Error removing session from Redis: %v", err)
			// Continue anyway to clean database
		}

		// Soft delete from database
		if err := j.db.DB.Delete(&session).Error; err != nil {
			log.Printf("[JOB] Error deleting session from database: %v", err)
			continue
		}

		cleanedCount++
	}

	log.Printf("[JOB] Session cleanup completed. Cleaned %d sessions", cleanedCount)
	return nil
}

// Start runs the job periodically
func (j *SessionCleanupJob) Start(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	// Run immediately on start
	if err := j.Run(ctx); err != nil {
		log.Printf("[JOB] Initial session cleanup failed: %v", err)
	}

	// Run periodically
	for {
		select {
		case <-ctx.Done():
			log.Println("[JOB] Session cleanup job stopped")
			return
		case <-ticker.C:
			if err := j.Run(ctx); err != nil {
				log.Printf("[JOB] Session cleanup failed: %v", err)
			}
		}
	}
}
