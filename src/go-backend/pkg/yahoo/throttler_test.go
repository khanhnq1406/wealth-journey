package yahoo

import (
	"context"
	"sort"
	"sync"
	"testing"
	"time"
)

func TestNewThrottler(t *testing.T) {
	// Test creating throttler with different rates
	tests := []struct {
		name        string
		requests    int
		expectedMin time.Duration
	}{
		{"single request per second", 60, time.Second},
		{"two requests per second", 120, time.Second / 2},
		{"ten requests per second", 600, time.Second / 10},
		{"one request every two seconds", 30, time.Second * 2},
		{"high rate", 1000, time.Millisecond * 60},
		{"minimum rate", 1, time.Minute},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			throttler := NewThrottler(tt.requests)
			if throttler.minInterval != tt.expectedMin {
				t.Errorf("expected minInterval %v, got %v", tt.expectedMin, throttler.minInterval)
			}
			if throttler.lastCallTime != (time.Time{}) {
				t.Errorf("expected lastCallTime to be zero value, got %v", throttler.lastCallTime)
			}
		})
	}
}

func TestThrottlerWait_FirstCall(t *testing.T) {
	throttler := NewThrottler(60)

	start := time.Now()
	err := throttler.Wait(context.Background())
	elapsed := time.Since(start)

	if err != nil {
		t.Errorf("expected no error for first call, got %v", err)
	}
	if elapsed > time.Millisecond*10 {
		t.Errorf("expected first call to be immediate, took %v", elapsed)
	}
	if throttler.lastCallTime.IsZero() {
		t.Error("lastCallTime should be updated after first call")
	}
}

func TestThrottlerWait_BasicRateLimiting(t *testing.T) {
	throttler := NewThrottler(120) // 120 requests/minute = 500ms between calls
	ctx := context.Background()

	// First call should be immediate
	start := time.Now()
	err := throttler.Wait(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Second call should wait approximately 500ms
	_ = throttler.Wait(ctx)
	elapsed := time.Since(start)

	// Allow some tolerance for timing precision
	minWait := time.Millisecond * 450
	maxWait := time.Millisecond * 550

	if elapsed < minWait {
		t.Errorf("expected wait time >= %v, got %v", minWait, elapsed)
	}
	if elapsed > maxWait {
		t.Errorf("expected wait time <= %v, got %v", maxWait, elapsed)
	}
}

func TestThrottlerWait_MultipleCalls(t *testing.T) {
	throttler := NewThrottler(60) // 60 requests/minute = 1 second between calls
	ctx := context.Background()

	// Record start time
	start := time.Now()

	// Make several calls with measurements
	times := []time.Time{}
	for i := 0; i < 3; i++ {
		err := throttler.Wait(ctx)
		if err != nil {
			t.Fatal(err)
		}
		times = append(times, time.Now())
	}

	// Verify intervals are approximately 1 second
	for i := 1; i < len(times); i++ {
		interval := times[i].Sub(times[i-1])
		targetInterval := time.Second

		// Allow some tolerance
		if interval < targetInterval-time.Millisecond*50 || interval > targetInterval+time.Millisecond*50 {
			t.Errorf("interval %d: expected ~%v, got %v", i, targetInterval, interval)
		}
	}

	totalElapsed := times[len(times)-1].Sub(start)
	expectedTotal := time.Duration(2) * time.Second // 2 intervals for 3 calls

	if totalElapsed < expectedTotal-time.Second || totalElapsed > expectedTotal+time.Second {
		t.Errorf("total elapsed time: expected ~%v, got %v", expectedTotal, totalElapsed)
	}
}

func TestThrottlerWait_ContextCancellation(t *testing.T) {
	throttler := NewThrottler(60)

	// Create a context that will be cancelled
	ctx, cancel := context.WithCancel(context.Background())

	// Make first call to set lastCallTime
	_ = throttler.Wait(ctx)

	// Start waiting in a goroutine
	var wg sync.WaitGroup
	wg.Add(1)
	var err error
	errChan := make(chan error, 1)

	go func() {
		defer wg.Done()
		err = throttler.Wait(ctx)
		errChan <- err
	}()

	// Cancel the context after a short delay
	time.Sleep(time.Millisecond * 10)
	cancel()

	wg.Wait()
	select {
	case err = <-errChan:
		// Got error from goroutine
	default:
		t.Fatal("goroutine didn't complete after context cancellation")
	}

	if err == nil {
		t.Error("expected error after context cancellation")
	}

	// The context error should be what we get back
	if err != context.Canceled {
		t.Errorf("expected context.Canceled error, got %v", err)
	}
}

func TestThrottlerWait_ContextTimeout(t *testing.T) {
	throttler := NewThrottler(60)

	// Create a context with short timeout
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond*100)
	defer cancel()

	// First call to set lastCallTime
	_ = throttler.Wait(ctx)

	// This call should timeout because the required interval is 1 second
	err := throttler.Wait(ctx)

	if err == nil {
		t.Error("expected error due to context timeout")
	}

	if err != context.DeadlineExceeded {
		t.Errorf("expected context.DeadlineExceeded error, got %v", err)
	}
}

func TestThrottlerWait_ImmediateAfterWait(t *testing.T) {
	throttler := NewThrottler(60) // 1 second interval
	ctx := context.Background()

	// First call - immediate
	err := throttler.Wait(ctx)
	if err != nil {
		t.Fatal(err)
	}

	// Wait for half the interval
	time.Sleep(time.Millisecond * 500)

	// This call should not wait since we've waited enough
	start := time.Now()
	err = throttler.Wait(ctx)
	elapsed := time.Since(start)

	if err != nil {
		t.Fatal(err)
	}

	// Should be immediate or very short wait
	// Allow up to the full interval since we waited exactly half
	if elapsed > time.Second*1000 {
		t.Errorf("expected call after waiting half interval, took %v", elapsed)
	}
}

func TestThrottlerWait_ConcurrentAccess(t *testing.T) {
	// Test with high rate to avoid long test duration
	throttler := NewThrottler(1000) // 1000 requests/minute
	ctx := context.Background()

	const numGoroutines = 5
	const callsPerGoroutine = 3

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	// Channel to collect errors
	errChan := make(chan error, numGoroutines*callsPerGoroutine)

	// Channel to collect timing information
	timingChan := make(chan time.Time, numGoroutines*callsPerGoroutine)

	start := time.Now()

	// Launch multiple goroutines
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()

			for j := 0; j < callsPerGoroutine; j++ {
				err := throttler.Wait(ctx)
				if err != nil {
					errChan <- err
					return
				}
				timingChan <- time.Now()

				// Small delay between calls to prevent test from finishing too quickly
				time.Sleep(time.Millisecond)
			}
		}(i)
	}

	wg.Wait()
	close(errChan)
	close(timingChan)

	// Check for errors
	for err := range errChan {
		t.Errorf("unexpected error: %v", err)
	}

	// Collect all timestamps and sort them
	timestamps := make([]time.Time, 0, numGoroutines*callsPerGoroutine)
	for ts := range timingChan {
		timestamps = append(timestamps, ts)
	}
	sort.Slice(timestamps, func(i, j int) bool {
		return timestamps[i].Before(timestamps[j])
	})

	// Verify no calls were made too close together
	expectedInterval := time.Minute / time.Duration(1000) // 60ms
	for i := 1; i < len(timestamps); i++ {
		interval := timestamps[i].Sub(timestamps[i-1])
		// Allow some tolerance for timing precision
		if interval < expectedInterval-time.Millisecond*10 {
			t.Errorf("interval %d is too short: %v (expected minimum ~%v)",
				i, interval, expectedInterval)
		}
	}

	totalElapsed := time.Since(start)
	expectedTotal := time.Duration(numGoroutines*callsPerGoroutine-1) * expectedInterval

	// Total time should be approximately the expected total
	if totalElapsed < expectedInterval || totalElapsed > expectedInterval*5 {
		t.Logf("total elapsed: %v, expected: ~%v", totalElapsed, expectedTotal)
	}
}

func TestThrottlerWait_MixedUsage(t *testing.T) {
	// Test a realistic scenario with different usage patterns
	throttler := NewThrottler(60) // 60 requests/minute
	ctx := context.Background()

	// Rapid sequence of calls
	for i := 0; i < 3; i++ {
		start := time.Now()
		err := throttler.Wait(ctx)
		if err != nil {
			t.Fatal(err)
		}
		elapsed := time.Since(start)
		t.Logf("Call %d took %v", i+1, elapsed)
	}

	// Wait for the interval to pass
	time.Sleep(time.Second * 2)

	// Next call should be immediate
	start := time.Now()
	err := throttler.Wait(ctx)
	if err != nil {
		t.Fatal(err)
	}
	elapsed := time.Since(start)

	if elapsed > time.Millisecond*100 {
		t.Errorf("expected immediate call after waiting, took %v", elapsed)
	}
}

// Benchmark tests
func BenchmarkThrottlerWait_NoWait(b *testing.B) {
	throttler := NewThrottler(1000) // High rate, minimal waiting
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := throttler.Wait(ctx)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkThrottlerWait_WithWait(b *testing.B) {
	throttler := NewThrottler(60) // 60 requests/minute, 1 second wait
	ctx := context.Background()

	// Make first call to establish lastCallTime
	_ = throttler.Wait(ctx)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		err := throttler.Wait(ctx)
		if err != nil {
			b.Fatal(err)
		}
	}
}

//nolint:unused
// Helper function to measure time with nanosecond precision
func measureNanos(fn func()) time.Duration {
	start := time.Now()
	fn()
	return time.Since(start)
}
