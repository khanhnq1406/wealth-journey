package scheduler

import (
	"context"
	"log"
	"time"

	"wealthjourney/domain/service"
	"wealthjourney/pkg/types"
	investmentv1 "wealthjourney/protobuf/v1"
)

// PriceUpdateJob fetches current market prices for all user investments.
type PriceUpdateJob struct {
	userSvc       service.UserService
	investmentSvc service.InvestmentService
}

func NewPriceUpdateJob(userSvc service.UserService, investmentSvc service.InvestmentService) *PriceUpdateJob {
	return &PriceUpdateJob{userSvc: userSvc, investmentSvc: investmentSvc}
}

func (j *PriceUpdateJob) Name() string            { return "price-update" }
func (j *PriceUpdateJob) Interval() time.Duration  { return 15 * time.Minute }
func (j *PriceUpdateJob) StartupDelay() time.Duration { return 5 * time.Second }

func (j *PriceUpdateJob) Run(ctx context.Context) error {
	log.Println("Running scheduled price update...")

	usersResp, err := j.userSvc.ListUsers(ctx, types.PaginationParams{
		Page:     1,
		PageSize: 1000,
	})
	if err != nil {
		return err
	}

	if !usersResp.Success || len(usersResp.Users) == 0 {
		log.Println("No users found for price update")
		return nil
	}

	log.Printf("Updating prices for %d users...", len(usersResp.Users))

	successCount := 0
	errorCount := 0

	for _, user := range usersResp.Users {
		updateResp, err := j.investmentSvc.UpdatePrices(ctx, user.Id, &investmentv1.UpdatePricesRequest{
			InvestmentIds: []int32{},
			ForceRefresh:  false,
		})

		if err != nil {
			log.Printf("Failed to update prices for user %d (%s): %v", user.Id, user.Email, err)
			errorCount++
			continue
		}

		if updateResp.Success {
			successCount++
		}
	}

	log.Printf("Scheduled price update completed: %d users updated, %d errors", successCount, errorCount)
	return nil
}
