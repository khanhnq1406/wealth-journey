package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
)

// PortfolioSnapshotJob records historical portfolio values for performance charts.
type PortfolioSnapshotJob struct {
	userRepo     repository.UserRepository
	portfolioSvc service.PortfolioHistoryService
}

func NewPortfolioSnapshotJob(
	userRepo repository.UserRepository,
	portfolioSvc service.PortfolioHistoryService,
) *PortfolioSnapshotJob {
	return &PortfolioSnapshotJob{
		userRepo:     userRepo,
		portfolioSvc: portfolioSvc,
	}
}

func (j *PortfolioSnapshotJob) Name() string            { return "portfolio-snapshot" }
func (j *PortfolioSnapshotJob) Interval() time.Duration  { return 1 * time.Hour }
func (j *PortfolioSnapshotJob) StartupDelay() time.Duration { return 10 * time.Second }

func (j *PortfolioSnapshotJob) Run(ctx context.Context) error {
	log.Println("Running portfolio snapshot job...")

	users, _, err := j.userRepo.List(ctx, repository.ListOptions{
		Limit: 10000,
	})
	if err != nil {
		return err
	}

	log.Printf("Creating portfolio snapshots for %d users...", len(users))

	successCount := 0
	errorCount := 0
	skippedCount := 0

	for _, user := range users {
		if err := j.portfolioSvc.CreateAggregatedSnapshot(ctx, user.ID); err != nil {
			log.Printf("Error: failed to create portfolio snapshot for user %d: %v", user.ID, err)
			errorCount++
			continue
		}

		successCount++
	}

	log.Printf("Portfolio snapshot job completed: %d successful, %d skipped, %d errors",
		successCount, skippedCount, errorCount)
	return nil
}
