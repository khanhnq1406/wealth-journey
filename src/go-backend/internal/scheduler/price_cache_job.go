package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/service"
)

// PriceCacheJob fetches fresh gold, silver, and currency prices from live
// price services and persists them to the DB-backed asset_price cache table.
// This allows HTTP handlers to serve prices directly from the DB without
// hitting external APIs on every request.
type PriceCacheJob struct {
	assetPriceSvc service.AssetPriceService
}

// NewPriceCacheJob creates a new PriceCacheJob.
func NewPriceCacheJob(assetPriceSvc service.AssetPriceService) *PriceCacheJob {
	return &PriceCacheJob{assetPriceSvc: assetPriceSvc}
}

func (j *PriceCacheJob) Name() string               { return "price-cache" }
func (j *PriceCacheJob) Interval() time.Duration    { return 15 * time.Minute }
func (j *PriceCacheJob) StartupDelay() time.Duration { return 10 * time.Second }

func (j *PriceCacheJob) Run(ctx context.Context) error {
	log.Println("Running price cache job...")
	if err := j.assetPriceSvc.RefreshAllPrices(ctx); err != nil {
		return err
	}
	log.Println("Price cache job completed successfully")
	return nil
}
