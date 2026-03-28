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
	assetPriceSvc AssetPriceService
	notifRepo     repository.NotificationRepository
	userRepo      repository.UserRepository
	redisClient   *pkgredis.RedisClient
	pushSvc       PushService
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
	assetPriceSvc AssetPriceService,
	notifRepo repository.NotificationRepository,
	userRepo repository.UserRepository,
	rdb *pkgredis.RedisClient,
	pushSvc PushService,
) PriceAlertService {
	return &priceAlertService{
		assetPriceSvc: assetPriceSvc,
		notifRepo:     notifRepo,
		userRepo:      userRepo,
		redisClient:   rdb,
		pushSvc:       pushSvc,
	}
}

func (s *priceAlertService) CheckAndAlert(ctx context.Context) error {
	return s.doCheckAndAlert(ctx, false)
}

const forceTriggerCooldownKey = "price_alert:force_trigger_cooldown"
const forceTriggerCooldownDuration = 30 * time.Second

func (s *priceAlertService) ForceCheckAndAlert(ctx context.Context) error {
	// Rate-limit force triggers to prevent notification spam
	exists, _ := s.redisClient.GetClient().Exists(ctx, forceTriggerCooldownKey).Result()
	if exists > 0 {
		return fmt.Errorf("please wait before triggering again")
	}
	s.redisClient.GetClient().Set(ctx, forceTriggerCooldownKey, "1", forceTriggerCooldownDuration)

	return s.doCheckAndAlert(ctx, true)
}

func (s *priceAlertService) doCheckAndAlert(ctx context.Context, force bool) error {
	cfg := LoadPriceAlertConfig(ctx, s.redisClient)

	type categoryMovers struct {
		category string
		movers   []priceMover
	}

	var allCategories []categoryMovers

	// Fetch gold prices from DB cache
	goldPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "gold")
	if err != nil {
		log.Printf("Price alert: failed to fetch gold prices: %v", err)
	} else {
		var goldVND, goldUSD []priceMover
		for _, p := range goldPrices {
			if p.IsStale {
				log.Printf("Price alert: skipping stale gold price for %s", p.TypeCode)
				continue
			}
			var mover *priceMover
			if force {
				mover = s.checkPriceForce(ctx, p.TypeCode, p.Buy)
			} else {
				mover = s.checkPrice(ctx, p.TypeCode, p.Buy)
			}
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

	// Fetch silver prices from DB cache
	silverPrices, err := s.assetPriceSvc.GetPricesByAssetType(ctx, "silver")
	if err != nil {
		log.Printf("Price alert: failed to fetch silver prices: %v", err)
	} else {
		var silverVND, silverUSD []priceMover
		for _, p := range silverPrices {
			if p.IsStale {
				log.Printf("Price alert: skipping stale silver price for %s", p.TypeCode)
				continue
			}
			var mover *priceMover
			if force {
				mover = s.checkPriceForce(ctx, p.TypeCode, p.Buy)
			} else {
				mover = s.checkPrice(ctx, p.TypeCode, p.Buy)
			}
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

		var significant []priceMover
		if force {
			// Force mode: include ALL movers regardless of threshold
			significant = cat.movers
		} else {
			// Normal mode: filter movers that exceed threshold
			for _, m := range cat.movers {
				if m.ChangePct >= catCfg.ThresholdPct {
					significant = append(significant, m)
				}
			}
		}
		if len(significant) == 0 {
			continue
		}

		// Check cooldown (skip in force mode)
		cooldownKey := fmt.Sprintf("price_alert:cooldown:%s", cat.category)
		if !force {
			exists, _ := s.redisClient.GetClient().Exists(ctx, cooldownKey).Result()
			if exists > 0 {
				continue
			}
		}

		// Sort by change % descending and take top N
		sort.Slice(significant, func(i, j int) bool {
			return significant[i].ChangePct > significant[j].ChangePct
		})
		if len(significant) > cfg.TopMoversCount {
			significant = significant[:cfg.TopMoversCount]
		}

		// Resolve templates for metadata (used by in-app notification display)
		topMover := significant[0]
		placeholders := map[string]string{
			"moverName":     topMover.Name,
			"moverCode":     topMover.TypeCode,
			"direction":     directionSymbol(topMover.Direction),
			"directionText": directionText(topMover.Direction),
			"changePct":     fmt.Sprintf("%.1f", topMover.ChangePct),
			"priceDiff":     FormatPriceForDisplay(topMover.PriceDiff, cat.category),
			"currentPrice":  FormatPriceForDisplay(topMover.Current, cat.category),
			"baselinePrice": FormatPriceForDisplay(topMover.Baseline, cat.category),
			"category":      categoryDisplayName(cat.category),
			"moverCount":    fmt.Sprintf("%d", len(significant)),
			"priceUnit":     priceUnitForMover(cat.category, topMover.TypeCode),
			"currency":      categoryCurrency(cat.category),
		}
		resolvedTitle := ResolvePlaceholders(catCfg.TitleTemplate, placeholders)
		resolvedBody := ResolvePlaceholders(catCfg.BodyTemplate, placeholders)

		// Build metadata
		metadata := map[string]interface{}{
			"category":  cat.category,
			"movers":    significant,
			"checkTime": time.Now().Unix(),
			"title":     resolvedTitle,
			"body":      resolvedBody,
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

		// Push notification — reuse already-resolved templates
		if s.pushSvc != nil {
			_ = s.pushSvc.SendToAll(ctx, resolvedTitle, resolvedBody, "/dashboard/home")
		}

		if !force {
			// Set cooldown (skip in force mode to not affect scheduled alerts)
			cooldownDuration := time.Duration(cfg.CooldownMinutes) * time.Minute
			s.redisClient.GetClient().Set(ctx, cooldownKey, "1", cooldownDuration)

			// Update baselines (skip in force mode to not affect scheduled alerts)
			for _, m := range cat.movers {
				baselineKey := fmt.Sprintf("price_alert:baseline:%s", m.TypeCode)
				s.redisClient.GetClient().Set(ctx, baselineKey, m.Current, 0)
			}
		}

		log.Printf("Price alert: sent %s alert to %d users (%d movers, force=%v)", cat.category, len(userIDs), len(significant), force)
	}

	return nil
}

// checkPriceForce returns a priceMover for any valid price, using the baseline
// if available or the current price as both current and baseline (0% change).
// Unlike checkPrice, it never returns nil for valid prices and never sets baselines.
func (s *priceAlertService) checkPriceForce(ctx context.Context, typeCode string, currentBuy int64) *priceMover {
	if currentBuy <= 0 {
		return nil
	}

	baseline := currentBuy // default: same as current (0% change)
	direction := "up"
	changePct := 0.0

	baselineKey := fmt.Sprintf("price_alert:baseline:%s", typeCode)
	baselineStr, err := s.redisClient.GetClient().Get(ctx, baselineKey).Result()
	if err == nil {
		if parsed, parseErr := strconv.ParseInt(baselineStr, 10, 64); parseErr == nil && parsed > 0 {
			baseline = parsed
			changePct = math.Abs(float64(currentBuy-baseline)) / float64(baseline) * 100
			changePct = math.Round(changePct*100) / 100
			if currentBuy < baseline {
				direction = "down"
			}
		}
	}

	return &priceMover{
		TypeCode:  typeCode,
		Direction: direction,
		ChangePct: changePct,
		Current:   currentBuy,
		Baseline:  baseline,
		PriceDiff: currentBuy - baseline,
	}
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
