package scheduler

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// Mock Job for scheduler tests
// ---------------------------------------------------------------------------

type mockJob struct {
	name     string
	interval time.Duration
	delay    time.Duration
	runCount atomic.Int64
	runErr   error
}

func (m *mockJob) Name() string               { return m.name }
func (m *mockJob) Interval() time.Duration    { return m.interval }
func (m *mockJob) StartupDelay() time.Duration { return m.delay }
func (m *mockJob) Run(_ context.Context) error {
	m.runCount.Add(1)
	return m.runErr
}

// ---------------------------------------------------------------------------
// Tests: Scheduler immediate first-run behaviour
// ---------------------------------------------------------------------------

// TestScheduler_RunsJobImmediatelyAfterStartupDelay verifies that a job is
// executed once right after its startup delay, before the first ticker fires.
// Prior to the fix the job only ran after StartupDelay + Interval.
func TestScheduler_RunsJobImmediatelyAfterStartupDelay(t *testing.T) {
	job := &mockJob{
		name:     "test-immediate",
		interval: 10 * time.Second, // long interval — must NOT be needed for first run
		delay:    0,                // no startup delay so the test stays fast
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	s := New(job)
	s.Start(ctx)

	// Give the goroutine time to run the first execution (should be near-instant
	// since StartupDelay = 0), but far shorter than the 10-second ticker interval.
	deadline := time.After(200 * time.Millisecond)
	for {
		select {
		case <-deadline:
			got := job.runCount.Load()
			if got < 1 {
				t.Errorf("job run count after 200ms = %d, want >= 1 (immediate run not happening)", got)
			}
			return
		case <-time.After(10 * time.Millisecond):
			if job.runCount.Load() >= 1 {
				return // pass — immediate run happened
			}
		}
	}
}
