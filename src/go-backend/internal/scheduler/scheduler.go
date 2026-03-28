package scheduler

import (
	"context"
	"log"
	"sync"
	"time"
)

// Job represents a background job that runs on a schedule.
type Job interface {
	Name() string
	Interval() time.Duration
	StartupDelay() time.Duration
	Run(ctx context.Context) error
}

// Scheduler manages and runs background jobs.
type Scheduler struct {
	jobs []Job
	wg   sync.WaitGroup
}

// New creates a new scheduler with the given jobs.
func New(jobs ...Job) *Scheduler {
	return &Scheduler{jobs: jobs}
}

// Start launches all jobs as background goroutines.
// Call Stop to gracefully shut down all jobs.
func (s *Scheduler) Start(ctx context.Context) {
	for _, j := range s.jobs {
		s.wg.Add(1)
		go s.runJob(ctx, j)
	}
	log.Printf("Scheduler started with %d jobs", len(s.jobs))
}

// Stop waits for all jobs to finish (after ctx is cancelled).
func (s *Scheduler) Stop() {
	s.wg.Wait()
	log.Println("Scheduler stopped")
}

func (s *Scheduler) runJob(ctx context.Context, j Job) {
	defer s.wg.Done()

	if delay := j.StartupDelay(); delay > 0 {
		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return
		}
	}

	log.Printf("Background job '%s' started (runs every %v)", j.Name(), j.Interval())

	// Run immediately on startup so the cache is populated before the first
	// ticker fires (which would otherwise be a full Interval away).
	if err := j.Run(ctx); err != nil {
		log.Printf("ERROR: Job '%s' failed on startup run: %v", j.Name(), err)
	}

	ticker := time.NewTicker(j.Interval())
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := j.Run(ctx); err != nil {
				log.Printf("ERROR: Job '%s' failed: %v", j.Name(), err)
			}
		case <-ctx.Done():
			log.Printf("Background job '%s' stopped (shutting down)", j.Name())
			return
		}
	}
}
