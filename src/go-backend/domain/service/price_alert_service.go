package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"sort"
	"strconv"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	pkgredis "wealthjourney/pkg/redis"

	"gorm.io/datatypes"
)

type priceAlertService struct {
	goldPriceSvc   GoldPriceService
	silverPriceSvc SilverPriceService
	notifRepo      repository.NotificationRepository
	userRepo       repository.UserRepository
	redisClient    *pkgredis.RedisClient
	pushSvc        PushService
}

type priceMover struct {
	TypeCode  string  `json:"typeCode"`
	Name      string  `json:"name"`
	Direction string  `json:"direction"` // "up" or "down"
	ChangePct float64 `json:"changePct"`
	Current   int64   `json:"current"`
	Baseline  int64   `json:"baseline"`
	PriceDiff int64   `json:"priceDiff"` // currentBuy - baseline
}

func NewPriceAlertService(
	goldPriceSvc GoldPriceService,
	silverPriceSvc SilverPriceService,
	notifRepo repository.NotificationRepository,
	userRepo repository.UserRepository,
	rdb *pkgredis.RedisClient,
	pushSvc PushService,
) PriceAlertService {
	return &priceAlertService{
		goldPriceSvc:   goldPriceSvc,
		silverPriceSvc: silverPriceSvc,
		notifRepo:      notifRepo,
		userRepo:       userRepo,
		redisClient:    rdb,
		pushSvc:        pushSvc,
	}
}

func (s *priceAlertService) CheckAndAlert(ctx context.Context) error {
	cfg := LoadPriceAlertConfig(ctx, s.redisClient)

	type categoryMovers struct {
		category string
		movers   []priceMover
	}

	var allCategories []categoryMovers

	// Fetch gold prices
	goldPrices, err := s.goldPriceSvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("Price alert: failed to fetch gold prices: %v", err)
	} else {
		var goldVND, goldUSD []priceMover
		for _, p := range goldPrices {
			mover := s.checkPrice(ctx, p.TypeCode, p.Buy)
			if mover == nil {
				continue
			}
			mover.Name = p.Name
			if p.Currency == "VND" {
				goldVND = append(goldVND, *mover)
			} else {
				goldUSD = append(goldUSD, *mover)
			}
		}
		if len(goldVND) > 0 {
			allCategories = append(allCategories, categoryMovers{
				category: "gold_vnd", movers: goldVND,
			})
		}
		if len(goldUSD) > 0 {
			allCategories = append(allCategories, categoryMovers{
				category: "gold_usd", movers: goldUSD,
			})
		}
	}

	// Fetch silver prices
	silverPrices, err := s.silverPriceSvc.FetchAllPrices(ctx)
	if err != nil {
		log.Printf("Price alert: failed to fetch silver prices: %v", err)
	} else {
		var silverVND, silverUSD []priceMover
		for _, p := range silverPrices {
			mover := s.checkPrice(ctx, p.TypeCode, p.Buy)
			if mover == nil {
				continue
			}
			mover.Name = p.Name
			if p.Currency == "VND" {
				silverVND = append(silverVND, *mover)
			} else {
				silverUSD = append(silverUSD, *mover)
			}
		}
		if len(silverVND) > 0 {
			allCategories = append(allCategories, categoryMovers{
				category: "silver_vnd", movers: silverVND,
			})
		}
		if len(silverUSD) > 0 {
			allCategories = append(allCategories, categoryMovers{
				category: "silver_usd", movers: silverUSD,
			})
		}
	}

	// Process each category
	for _, cat := range allCategories {
		catCfg, ok := cfg.Categories[cat.category]
		if !ok || !catCfg.Enabled {
			continue
		}

		// Filter movers that exceed threshold
		var significant []priceMover
		for _, m := range cat.movers {
			if m.ChangePct >= catCfg.ThresholdPct {
				significant = append(significant, m)
			}
		}
		if len(significant) == 0 {
			continue
		}

		// Check cooldown
		cooldownKey := fmt.Sprintf("price_alert:cooldown:%s", cat.category)
		exists, _ := s.redisClient.GetClient().Exists(ctx, cooldownKey).Result()
		if exists > 0 {
			continue
		}

		// Sort by change % descending and take top N
		sort.Slice(significant, func(i, j int) bool {
			return significant[i].ChangePct > significant[j].ChangePct
		})
		if len(significant) > cfg.TopMoversCount {
			significant = significant[:cfg.TopMoversCount]
		}

		// Build metadata
		metadata := map[string]interface{}{
			"category":  cat.category,
			"movers":    significant,
			"checkTime": time.Now().Unix(),
		}
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			log.Printf("Price alert: failed to marshal metadata for %s: %v", cat.category, err)
			continue
		}

		// Get all users
		userIDs, err := s.userRepo.GetAllUserIDs(ctx)
		if err != nil {
			log.Printf("Price alert: failed to get user IDs: %v", err)
			continue
		}

		// Build notifications batch
		now := time.Now()
		notifications := make([]*models.Notification, len(userIDs))
		for i, uid := range userIDs {
			notifications[i] = &models.Notification{
				UserID:    uid,
				Type:      "price_alert",
				Metadata:  datatypes.JSON(metadataJSON),
				CreatedAt: now,
			}
		}

		// Batch create
		if err := s.notifRepo.BatchCreate(ctx, notifications); err != nil {
			log.Printf("Price alert: failed to batch create notifications for %s: %v", cat.category, err)
			continue
		}

		// SSE publish
		for _, uid := range userIDs {
			channel := fmt.Sprintf("user:%d:notifications", uid)
			payload := map[string]interface{}{
				"type":     "price_alert",
				"actorId":  0,
				"userId":   uid,
				"metadata": string(metadataJSON),
			}
			_ = s.redisClient.Publish(channel, payload)
		}

		// Push notification — resolve templates
		if s.pushSvc != nil {
			topMover := significant[0]
			placeholders := map[string]string{
				"moverName":     topMover.Name,
				"moverCode":     topMover.TypeCode,
				"direction":     directionSymbol(topMover.Direction),
				"directionText": directionText(topMover.Direction),
				"changePct":     fmt.Sprintf("%.1f", topMover.ChangePct),
				"priceDiff":     FormatWithThousandSeparators(topMover.PriceDiff),
				"category":      categoryDisplayName(cat.category),
				"moverCount":    fmt.Sprintf("%d", len(significant)),
			}

			title := ResolvePlaceholders(catCfg.TitleTemplate, placeholders)
			body := ResolvePlaceholders(catCfg.BodyTemplate, placeholders)
			_ = s.pushSvc.SendToAll(ctx, title, body, "/dashboard/home")
		}

		// Set cooldown
		cooldownDuration := time.Duration(cfg.CooldownMinutes) * time.Minute
		s.redisClient.GetClient().Set(ctx, cooldownKey, "1", cooldownDuration)

		// Update baselines
		for _, m := range cat.movers {
			baselineKey := fmt.Sprintf("price_alert:baseline:%s", m.TypeCode)
			s.redisClient.GetClient().Set(ctx, baselineKey, m.Current, 0)
		}

		log.Printf("Price alert: sent %s alert to %d users (%d movers)", cat.category, len(userIDs), len(significant))
	}

	return nil
}

func (s *priceAlertService) checkPrice(ctx context.Context, typeCode string, currentBuy int64) *priceMover {
	if currentBuy <= 0 {
		return nil
	}

	baselineKey := fmt.Sprintf("price_alert:baseline:%s", typeCode)
	baselineStr, err := s.redisClient.GetClient().Get(ctx, baselineKey).Result()
	if err != nil {
		// First run: store baseline and skip
		s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 0)
		return nil
	}

	baseline, err := strconv.ParseInt(baselineStr, 10, 64)
	if err != nil || baseline <= 0 {
		s.redisClient.GetClient().Set(ctx, baselineKey, currentBuy, 0)
		return nil
	}

	changePct := math.Abs(float64(currentBuy-baseline)) / float64(baseline) * 100
	direction := "up"
	if currentBuy < baseline {
		direction = "down"
	}

	return &priceMover{
		TypeCode:  typeCode,
		Direction: direction,
		ChangePct: math.Round(changePct*100) / 100,
		Current:   currentBuy,
		Baseline:  baseline,
		PriceDiff: currentBuy - baseline,
	}
}

func envFloat(key string, defaultVal float64) float64 {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	f, err := strconv.ParseFloat(v, 64)
	if err != nil {
		return defaultVal
	}
	return f
}

func envInt(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	i, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return i
}
