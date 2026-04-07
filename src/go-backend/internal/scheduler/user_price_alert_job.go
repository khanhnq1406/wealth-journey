package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/service"
)

// UserPriceAlertJob evaluates active user price alerts every 15 minutes
// and fires notifications when conditions are met.
type UserPriceAlertJob struct {
	alertService service.UserPriceAlertService
}

// NewUserPriceAlertJob creates a new UserPriceAlertJob.
func NewUserPriceAlertJob(alertService service.UserPriceAlertService) *UserPriceAlertJob {
	return &UserPriceAlertJob{alertService: alertService}
}

func (j *UserPriceAlertJob) Name() string               { return "user-price-alert" }
func (j *UserPriceAlertJob) Interval() time.Duration    { return 15 * time.Minute }
func (j *UserPriceAlertJob) StartupDelay() time.Duration { return 45 * time.Second }

func (j *UserPriceAlertJob) Run(ctx context.Context) error {
	log.Println("Running user price alert evaluation...")
	if err := j.alertService.EvaluateAlerts(ctx); err != nil {
		log.Printf("User price alert evaluation failed: %v", err)
		return err
	}
	log.Println("User price alert evaluation completed")
	return nil
}
