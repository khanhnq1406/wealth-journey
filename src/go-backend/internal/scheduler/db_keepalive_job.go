package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/pkg/database"
)

// DBKeepAliveJob pings the database periodically to prevent idle connection drops.
// Includes a circuit breaker to avoid flooding a persistently down database.
type DBKeepAliveJob struct {
	db                  *database.Database
	attemptCount        int
	consecutiveFailures int
	circuitOpen         bool
}

const maxConsecutiveFailures = 5

func NewDBKeepAliveJob(db *database.Database) *DBKeepAliveJob {
	return &DBKeepAliveJob{db: db}
}

func (j *DBKeepAliveJob) Name() string            { return "db-keepalive" }
func (j *DBKeepAliveJob) Interval() time.Duration  { return 2 * time.Minute }
func (j *DBKeepAliveJob) StartupDelay() time.Duration { return 10 * time.Second }

func (j *DBKeepAliveJob) Run(_ context.Context) error {
	if j.circuitOpen {
		log.Printf("Database keep-alive circuit breaker OPEN - skipping ping")
		return nil
	}

	stats := j.db.Stats()

	if err := j.db.Ping(); err != nil {
		j.consecutiveFailures++
		log.Printf("Database keep-alive ping failed (%d/%d consecutive): %v | Pool stats: %+v",
			j.consecutiveFailures, maxConsecutiveFailures, err, stats)

		if j.consecutiveFailures >= maxConsecutiveFailures {
			log.Printf("Database keep-alive circuit breaker OPENED after %d consecutive failures",
				maxConsecutiveFailures)
			j.circuitOpen = true
		}
		return nil // Don't propagate — circuit breaker handles retries
	}

	if j.circuitOpen {
		log.Printf("Database keep-alive ping recovered - circuit breaker CLOSED")
		j.circuitOpen = false
	}
	if j.consecutiveFailures > 0 {
		log.Printf("Database keep-alive ping recovered after %d failures", j.consecutiveFailures)
		j.consecutiveFailures = 0
	}

	j.attemptCount++
	if j.attemptCount%5 == 0 {
		log.Printf("Database keep-alive ping success | Pool stats: open=%v, in_use=%v, idle=%v",
			stats["open_connections"], stats["in_use"], stats["idle"])
	}

	return nil
}
