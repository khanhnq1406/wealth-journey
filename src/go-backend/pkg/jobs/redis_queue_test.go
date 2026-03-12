package jobs

import (
	"context"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestRedis creates a Redis client for testing
// Requires Redis running on localhost:6379 for integration tests
func setupTestRedis(t *testing.T) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
		DB:   15, // Use test database
	})

	// Test connection
	ctx := context.Background()
	if err := client.Ping(ctx).Err(); err != nil {
		t.Skipf("Redis not available for integration test: %v", err)
	}

	// Clean up test database before test
	if err := client.FlushDB(ctx).Err(); err != nil {
		t.Fatalf("Failed to flush test database: %v", err)
	}

	return client
}

func TestCleanupExpiredJobs_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	queue := NewRedisImportQueue(client)
	ctx := context.Background()

	// Given: Job queue with 3 expired jobs and 2 active jobs
	now := time.Now()
	expiredTime := now.Add(-2 * time.Hour)   // Expired 2 hours ago
	activeTime := now.Add(24 * time.Hour)     // Expires in 24 hours

	// Create 3 expired jobs
	expiredJobs := []*ImportJob{
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "file1",
			WalletID:  1,
			Status:    JobStatusCompleted,
			CreatedAt: expiredTime.Add(-3 * time.Hour),
			ExpiresAt: expiredTime,
		},
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "file2",
			WalletID:  1,
			Status:    JobStatusFailed,
			CreatedAt: expiredTime.Add(-2 * time.Hour),
			ExpiresAt: expiredTime,
		},
		{
			JobID:     uuid.New().String(),
			UserID:    2,
			FileID:    "file3",
			WalletID:  2,
			Status:    JobStatusCancelled,
			CreatedAt: expiredTime.Add(-1 * time.Hour),
			ExpiresAt: expiredTime,
		},
	}

	// Create 2 active jobs (not expired yet)
	activeJobs := []*ImportJob{
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "file4",
			WalletID:  1,
			Status:    JobStatusCompleted,
			CreatedAt: now,
			ExpiresAt: activeTime,
		},
		{
			JobID:     uuid.New().String(),
			UserID:    2,
			FileID:    "file5",
			WalletID:  2,
			Status:    JobStatusProcessing,
			CreatedAt: now,
			ExpiresAt: activeTime,
		},
	}

	// Store expired jobs
	for _, job := range expiredJobs {
		err := queue.Enqueue(ctx, job)
		require.NoError(t, err)
	}

	// Store active jobs
	for _, job := range activeJobs {
		err := queue.Enqueue(ctx, job)
		require.NoError(t, err)
	}

	// Verify all jobs exist before cleanup
	for _, job := range expiredJobs {
		retrieved, err := queue.GetJob(ctx, job.JobID)
		require.NoError(t, err)
		require.NotNil(t, retrieved, "Expired job should exist before cleanup")
	}
	for _, job := range activeJobs {
		retrieved, err := queue.GetJob(ctx, job.JobID)
		require.NoError(t, err)
		require.NotNil(t, retrieved, "Active job should exist")
	}

	// When: CleanupExpiredJobs is called
	deleted, err := queue.CleanupExpiredJobs(ctx)

	// Then: 3 expired jobs are deleted
	require.NoError(t, err)
	assert.Equal(t, 3, deleted, "Should delete 3 expired jobs")

	// And: Expired jobs no longer exist
	for _, job := range expiredJobs {
		retrieved, err := queue.GetJob(ctx, job.JobID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "Expired job should be deleted")
	}

	// And: 2 active jobs remain
	for _, job := range activeJobs {
		retrieved, err := queue.GetJob(ctx, job.JobID)
		require.NoError(t, err)
		assert.NotNil(t, retrieved, "Active job should still exist")
	}
}

func TestCleanupExpiredJobs_EmptyQueue(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	queue := NewRedisImportQueue(client)
	ctx := context.Background()

	// Given: Empty job queue
	// When: CleanupExpiredJobs is called
	deleted, err := queue.CleanupExpiredJobs(ctx)

	// Then: No errors and 0 jobs deleted
	require.NoError(t, err)
	assert.Equal(t, 0, deleted, "Should delete 0 jobs from empty queue")
}

func TestCleanupExpiredJobs_OnlyActiveJobs(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer func() { _ = client.Close() }()

	queue := NewRedisImportQueue(client)
	ctx := context.Background()

	// Given: Job queue with only active jobs
	now := time.Now()
	activeJobs := []*ImportJob{
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "file1",
			WalletID:  1,
			Status:    JobStatusProcessing,
			CreatedAt: now,
			ExpiresAt: now.Add(24 * time.Hour),
		},
		{
			JobID:     uuid.New().String(),
			UserID:    2,
			FileID:    "file2",
			WalletID:  2,
			Status:    JobStatusQueued,
			CreatedAt: now,
			ExpiresAt: now.Add(48 * time.Hour),
		},
	}

	// Store active jobs
	for _, job := range activeJobs {
		err := queue.Enqueue(ctx, job)
		require.NoError(t, err)
	}

	// When: CleanupExpiredJobs is called
	deleted, err := queue.CleanupExpiredJobs(ctx)

	// Then: No errors and 0 jobs deleted
	require.NoError(t, err)
	assert.Equal(t, 0, deleted, "Should delete 0 jobs (all are active)")

	// And: All active jobs still exist
	for _, job := range activeJobs {
		retrieved, err := queue.GetJob(ctx, job.JobID)
		require.NoError(t, err)
		assert.NotNil(t, retrieved, "Active job should still exist")
	}
}

func TestCleanupExpiredJobs_MixedStatuses(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	client := setupTestRedis(t)
	defer client.Close()

	queue := NewRedisImportQueue(client)
	ctx := context.Background()

	// Given: Expired jobs in various statuses (completed, failed, cancelled)
	now := time.Now()
	expiredTime := now.Add(-1 * time.Hour)

	expiredJobs := []*ImportJob{
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "completed",
			WalletID:  1,
			Status:    JobStatusCompleted,
			CreatedAt: expiredTime.Add(-2 * time.Hour),
			ExpiresAt: expiredTime,
		},
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "failed",
			WalletID:  1,
			Status:    JobStatusFailed,
			CreatedAt: expiredTime.Add(-2 * time.Hour),
			ExpiresAt: expiredTime,
			Error:     "test error",
		},
		{
			JobID:     uuid.New().String(),
			UserID:    1,
			FileID:    "cancelled",
			WalletID:  1,
			Status:    JobStatusCancelled,
			CreatedAt: expiredTime.Add(-2 * time.Hour),
			ExpiresAt: expiredTime,
		},
	}

	// Store expired jobs
	for _, job := range expiredJobs {
		err := queue.Enqueue(ctx, job)
		require.NoError(t, err)
	}

	// When: CleanupExpiredJobs is called
	deleted, err := queue.CleanupExpiredJobs(ctx)

	// Then: All expired jobs are deleted regardless of status
	require.NoError(t, err)
	assert.Equal(t, 3, deleted, "Should delete all 3 expired jobs")

	// And: All expired jobs are gone
	for _, job := range expiredJobs {
		retrieved, err := queue.GetJob(ctx, job.JobID)
		require.NoError(t, err)
		assert.Nil(t, retrieved, "Expired job should be deleted")
	}
}
