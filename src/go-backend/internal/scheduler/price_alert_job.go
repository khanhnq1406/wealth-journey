package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/service"
)

// PriceAlertJob checks for significant price fluctuations and sends alerts.
type PriceAlertJob struct {
	priceAlertSvc service.PriceAlertService
}

func NewPriceAlertJob(priceAlertSvc service.PriceAlertService) *PriceAlertJob {
	return &PriceAlertJob{priceAlertSvc: priceAlertSvc}
}

func (j *PriceAlertJob) Name() string              { return "price-alert" }
func (j *PriceAlertJob) Interval() time.Duration    { return 15 * time.Minute }
func (j *PriceAlertJob) StartupDelay() time.Duration { return 30 * time.Second }

func (j *PriceAlertJob) Run(ctx context.Context) error {
	log.Println("Running price alert check...")
	if err := j.priceAlertSvc.CheckAndAlert(ctx); err != nil {
		log.Printf("Price alert check failed: %v", err)
		return err
	}
	log.Println("Price alert check completed")
	return nil
}
