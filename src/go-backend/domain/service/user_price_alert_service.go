package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"gorm.io/datatypes"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/gold"
	pkgredis "wealthjourney/pkg/redis"
	"wealthjourney/pkg/silver"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"
)

const (
	maxUserPriceAlerts     = 30
	maxAlertCooldownHours  = 168 // 7 days
	minAlertCooldownHours  = 2
	alertPriceFetchTimeout = 5 * time.Second
)

// symbolPattern validates alert symbols: Unicode letters, digits, dots, dashes, underscores, spaces.
// \p{L} matches any Unicode letter (covers Vietnamese diacritics: à, ẫ, ạ, ơ, etc.).
// \p{N} matches any Unicode digit. Spaces are allowed for market ticker names.
// Gold/silver symbols are further validated against asset_price.type_code after this check.
// Special characters (<, >, ", ', ;, {, }) remain blocked.
var symbolPattern = regexp.MustCompile(`^[\p{L}\p{N}.\-_ ]+$`)

// userPriceAlertService implements UserPriceAlertService.
type userPriceAlertService struct {
	alertRepo     repository.UserPriceAlertRepository
	assetPriceSvc AssetPriceService
	marketDataSvc MarketDataService
	notifRepo     repository.NotificationRepository
	pushSvc       PushService
	rdb           *pkgredis.RedisClient
}

// NewUserPriceAlertService creates a new UserPriceAlertService.
func NewUserPriceAlertService(
	alertRepo repository.UserPriceAlertRepository,
	assetPriceSvc AssetPriceService,
	marketDataSvc MarketDataService,
	notifRepo repository.NotificationRepository,
	pushSvc PushService,
	rdb *pkgredis.RedisClient,
) UserPriceAlertService {
	return &userPriceAlertService{
		alertRepo:     alertRepo,
		assetPriceSvc: assetPriceSvc,
		marketDataSvc: marketDataSvc,
		notifRepo:     notifRepo,
		pushSvc:       pushSvc,
		rdb:           rdb,
	}
}

// CreateAlert creates a new price alert for the user.
func (s *userPriceAlertService) CreateAlert(ctx context.Context, userID int32, req *v1.CreateUserPriceAlertRequest) (*v1.CreateUserPriceAlertResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Validate and sanitize symbol
	symbol := strings.TrimSpace(req.Symbol)
	if len(symbol) == 0 || len(symbol) > 50 {
		return nil, apperrors.NewValidationError("symbol must be between 1 and 50 characters")
	}
	if !symbolPattern.MatchString(symbol) {
		return nil, apperrors.NewValidationError("symbol contains invalid characters")
	}

	// Validate and sanitize name
	name := strings.TrimSpace(req.Name)
	if len(name) == 0 || len(name) > 200 {
		return nil, apperrors.NewValidationError("name must be between 1 and 200 characters")
	}

	// Validate direction
	direction := alertDirectionToString(req.Direction)
	if direction == "" {
		return nil, apperrors.NewValidationError("direction must be 'above' or 'below'")
	}

	// Validate target price
	if req.TargetPrice <= 0 {
		return nil, apperrors.NewValidationError("target price must be greater than 0")
	}

	// Validate trigger mode and cooldown
	triggerMode := alertTriggerModeToString(req.TriggerMode)
	if triggerMode == "" {
		triggerMode = "once"
	}

	cooldownHours := req.CooldownHours
	if triggerMode == "repeat" {
		if cooldownHours < minAlertCooldownHours || cooldownHours > maxAlertCooldownHours {
			return nil, apperrors.NewValidationError(
				fmt.Sprintf("cooldown hours must be between %d and %d for repeat mode", minAlertCooldownHours, maxAlertCooldownHours),
			)
		}
	} else {
		// Default cooldown for once mode (not strictly used but stored)
		if cooldownHours == 0 {
			cooldownHours = 4
		}
	}

	// Validate price side
	priceSide := strings.TrimSpace(req.PriceSide)
	if priceSide == "" {
		priceSide = "buy"
	}
	if priceSide != "buy" && priceSide != "sell" {
		return nil, apperrors.NewValidationError("price side must be 'buy' or 'sell'")
	}

	// Sanitize note
	note, err := validator.SanitizeStringField(req.Note, 200)
	if err != nil {
		return nil, err
	}

	// Validate currency
	currency := strings.TrimSpace(req.Currency)
	if len(currency) < 2 || len(currency) > 3 {
		return nil, apperrors.NewValidationError("currency must be a 2-3 character ISO code")
	}

	// Check maximum active alert limit
	count, err := s.alertRepo.CountActiveByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}
	if count >= maxUserPriceAlerts {
		return nil, apperrors.NewValidationError("Maximum of 30 alerts reached")
	}

	// For gold/silver, validate that symbol matches a known asset_price.type_code.
	// This prevents alerts being created with display names (e.g. "Vàng nhẫn SJC") that
	// can never match the internal fetch codes used by fetchPricesForAlerts at evaluation time.
	// We reuse the lookup result as the creation-time price to avoid a second DB round-trip.
	var currentPrice int64
	if gold.IsGoldType(req.AssetType) || silver.IsSilverType(req.AssetType) {
		validateCtx, validateCancel := context.WithTimeout(ctx, alertPriceFetchTimeout)
		dto, lookupErr := s.assetPriceSvc.GetPriceByTypeCode(validateCtx, symbol)
		validateCancel()
		if lookupErr != nil || dto == nil {
			return nil, apperrors.NewValidationError(
				fmt.Sprintf("symbol '%s' does not match any known price code — use the internal type code (e.g. SJ9999, DOHCML)", symbol),
			)
		}
		if !dto.IsStale {
			if priceSide == "sell" {
				currentPrice = dto.Sell
			} else {
				currentPrice = dto.Buy
			}
		}
	} else {
		// Market assets (stocks, crypto): fetch best-effort; failure does not block creation
		currentPrice = s.fetchCurrentPrice(ctx, symbol, currency, req.AssetType, priceSide)
	}

	// Create model
	alert := &models.UserPriceAlert{
		UserID:                 userID,
		Symbol:                 symbol,
		Name:                   name,
		AssetType:              int32(req.AssetType),
		Currency:               currency,
		PriceSide:              priceSide,
		Direction:              direction,
		TargetPrice:            req.TargetPrice,
		TriggerMode:            triggerMode,
		CooldownHours:          cooldownHours,
		Status:                 "active",
		Note:                   note,
		TriggerCount:           0,
		CurrentPriceAtCreation: currentPrice,
	}

	if err := s.alertRepo.Create(ctx, alert); err != nil {
		return nil, err
	}

	return &v1.CreateUserPriceAlertResponse{
		Success:   true,
		Message:   "Price alert created successfully",
		Alert:     alert.ToProto(),
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// ListAlerts retrieves alerts for a user with optional status filtering and pagination.
func (s *userPriceAlertService) ListAlerts(ctx context.Context, userID int32, req *v1.ListUserPriceAlertsRequest) (*v1.ListUserPriceAlertsResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Convert proto status filter to string
	statusFilter := alertStatusToString(req.StatusFilter)

	// Build pagination from proto params
	opts := s.buildListOptions(req.Pagination)

	alerts, total, err := s.alertRepo.ListByUserID(ctx, userID, statusFilter, opts)
	if err != nil {
		return nil, err
	}

	// Enrich alerts with current prices grouped by asset type
	priceMap := s.fetchPricesForAlerts(ctx, alerts)

	protoAlerts := make([]*v1.UserPriceAlert, 0, len(alerts))
	for _, a := range alerts {
		pa := a.ToProto()
		// Populate current_price field if available
		if price, ok := priceMap[a.Symbol+"|"+a.PriceSide]; ok {
			pa.CurrentPrice = price
		}
		protoAlerts = append(protoAlerts, pa)
	}

	return &v1.ListUserPriceAlertsResponse{
		Success:   true,
		Message:   "Alerts retrieved successfully",
		Alerts:    protoAlerts,
		Total:     int32(total),
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// UpdateAlert updates mutable fields on an existing alert owned by the user.
func (s *userPriceAlertService) UpdateAlert(ctx context.Context, alertID int32, userID int32, req *v1.UpdateUserPriceAlertRequest) (*v1.UpdateUserPriceAlertResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if err := validator.ID(alertID); err != nil {
		return nil, apperrors.NewValidationError("invalid alert ID")
	}

	// Ownership-checked fetch — returns NotFoundError when userID doesn't match
	alert, err := s.alertRepo.GetByIDForUser(ctx, alertID, userID)
	if err != nil {
		return nil, err
	}

	// Apply updates for non-zero / non-unspecified fields
	if req.TargetPrice > 0 {
		alert.TargetPrice = req.TargetPrice
	}

	if req.TriggerMode != v1.AlertTriggerMode_ALERT_TRIGGER_MODE_UNSPECIFIED {
		alert.TriggerMode = alertTriggerModeToString(req.TriggerMode)
	}

	if req.CooldownHours != 0 {
		// Validate cooldown range only when repeat mode is active (or being set)
		effectiveTriggerMode := alert.TriggerMode
		if req.TriggerMode != v1.AlertTriggerMode_ALERT_TRIGGER_MODE_UNSPECIFIED {
			effectiveTriggerMode = alertTriggerModeToString(req.TriggerMode)
		}
		if effectiveTriggerMode == "repeat" {
			if req.CooldownHours < minAlertCooldownHours || req.CooldownHours > maxAlertCooldownHours {
				return nil, apperrors.NewValidationError(
					fmt.Sprintf("cooldown hours must be between %d and %d for repeat mode", minAlertCooldownHours, maxAlertCooldownHours),
				)
			}
		}
		alert.CooldownHours = req.CooldownHours
	}

	// Note is always updated (even empty string clears it)
	sanitizedNote, err := validator.SanitizeStringField(req.Note, 200)
	if err != nil {
		return nil, err
	}
	alert.Note = sanitizedNote

	if req.Status != v1.AlertStatus_ALERT_STATUS_UNSPECIFIED {
		newStatus := alertStatusToString(req.Status)
		if newStatus != "" {
			alert.Status = newStatus
		}
	}

	if err := s.alertRepo.Update(ctx, alert); err != nil {
		return nil, err
	}

	return &v1.UpdateUserPriceAlertResponse{
		Success:   true,
		Message:   "Price alert updated successfully",
		Alert:     alert.ToProto(),
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

// DeleteAlert soft-deletes a price alert, enforcing ownership.
func (s *userPriceAlertService) DeleteAlert(ctx context.Context, alertID int32, userID int32) (*v1.DeleteUserPriceAlertResponse, error) {
	if err := validator.ID(userID); err != nil {
		return nil, err
	}
	if err := validator.ID(alertID); err != nil {
		return nil, apperrors.NewValidationError("invalid alert ID")
	}

	if err := s.alertRepo.Delete(ctx, alertID, userID); err != nil {
		return nil, err
	}

	return &v1.DeleteUserPriceAlertResponse{
		Success:   true,
		Message:   "Price alert deleted successfully",
		Timestamp: fmt.Sprintf("%d", time.Now().Unix()),
	}, nil
}

const (
	alertDailyNotifCap       = 100
	alertCooldownKeyPrefix   = "user_price_alert:cooldown:"
	alertDailyCapKeyPrefix   = "user_price_alert:daily:"
	alertEvalPriceFetchTimeout = 30 * time.Second
)

// EvaluateAlerts fetches all active alerts, compares against current prices,
// and fires notifications for triggered conditions. Called by the background job every 15 minutes.
func (s *userPriceAlertService) EvaluateAlerts(ctx context.Context) error {
	alerts, err := s.alertRepo.ListActive(ctx)
	if err != nil {
		return fmt.Errorf("EvaluateAlerts: failed to list active alerts: %w", err)
	}
	if len(alerts) == 0 {
		log.Println("EvaluateAlerts: no active alerts found — skipping evaluation")
		return nil
	}

	// Load notification templates once per cycle (not per alert).
	// Falls back to hardcoded Vietnamese defaults if Redis is unavailable or config is missing.
	cfg := LoadPriceAlertConfig(ctx, s.rdb)

	// Build price map grouped by asset type to avoid redundant API calls
	fetchCtx, cancel := context.WithTimeout(ctx, alertEvalPriceFetchTimeout)
	defer cancel()
	priceMap := s.fetchPricesForAlerts(fetchCtx, alerts)

	var rdb = s.rdb
	total, triggered, skippedCooldown, skippedCap, errors := len(alerts), 0, 0, 0, 0

	for _, alert := range alerts {
		key := alert.Symbol + "|" + alert.PriceSide
		currentPrice, ok := priceMap[key]
		if !ok || currentPrice <= 0 {
			// Price unavailable — skip without deactivating
			continue
		}

		// Check trigger condition
		var fired bool
		switch alert.Direction {
		case "above":
			fired = currentPrice >= alert.TargetPrice
		case "below":
			fired = currentPrice <= alert.TargetPrice
		}
		if !fired {
			continue
		}

		// Check per-alert cooldown in Redis
		if rdb != nil {
			cooldownKey := fmt.Sprintf("%s%d", alertCooldownKeyPrefix, alert.ID)
			val, _ := rdb.GetClient().Get(ctx, cooldownKey).Result()
			if val != "" {
				skippedCooldown++
				continue
			}
		}

		// Check per-user daily notification cap
		if rdb != nil {
			dailyKey := fmt.Sprintf("%s%d", alertDailyCapKeyPrefix, alert.UserID)
			capVal, _ := rdb.GetClient().Get(ctx, dailyKey).Int()
			if capVal >= alertDailyNotifCap {
				skippedCap++
				continue
			}
		}

		// Resolve notification templates using the config loaded once at the top of EvaluateAlerts.
		placeholders := map[string]string{
			"name":         alert.Name,
			"symbol":       alert.Symbol,
			"price":        FormatUserAlertPrice(alert.TargetPrice, alert.Currency),
			"currentPrice": FormatUserAlertPrice(currentPrice, alert.Currency),
			"currency":     alert.Currency,
			"priceSide":    priceSideDisplayName(alert.PriceSide),
		}
		resolvedTitle := ResolvePlaceholders(cfg.UserAlertTitleTemplate, placeholders)
		// Truncate title to 65 chars to respect mobile push notification limits
		if len([]rune(resolvedTitle)) > 65 {
			runes := []rune(resolvedTitle)
			resolvedTitle = string(runes[:62]) + "…"
		}
		var resolvedBody string
		switch alert.Direction {
		case "above":
			resolvedBody = ResolvePlaceholders(cfg.UserAlertAboveBodyTemplate, placeholders)
		case "below":
			resolvedBody = ResolvePlaceholders(cfg.UserAlertBelowBodyTemplate, placeholders)
		default:
			resolvedBody = ResolvePlaceholders(cfg.UserAlertAboveBodyTemplate, placeholders)
		}

		// Build notification metadata
		metadata := map[string]interface{}{
			"alertId":       alert.ID,
			"symbol":        alert.Symbol,
			"name":          alert.Name,
			"direction":     alert.Direction,
			"targetPrice":   alert.TargetPrice,
			"currentPrice":  currentPrice,
			"priceSide":     alert.PriceSide,
			"currency":      alert.Currency,
			"resolvedTitle": resolvedTitle,
			"resolvedBody":  resolvedBody,
		}
		metadataJSON, err := json.Marshal(metadata)
		if err != nil {
			log.Printf("EvaluateAlerts: failed to marshal metadata for alert %d: %v", alert.ID, err)
			errors++
			continue
		}

		// Create in-app notification
		now := time.Now()
		if err := s.notifRepo.Create(ctx, &models.Notification{
			UserID:    alert.UserID,
			Type:      "user_price_alert",
			Metadata:  datatypes.JSON(metadataJSON),
			CreatedAt: now,
		}); err != nil {
			log.Printf("EvaluateAlerts: failed to create notification for alert %d: %v", alert.ID, err)
			errors++
			continue
		}

		// Publish SSE to active browser sessions
		if rdb != nil {
			channel := fmt.Sprintf("user:%d:notifications", alert.UserID)
			ssePayload := map[string]interface{}{
				"type":     "user_price_alert",
				"userId":   alert.UserID,
				"metadata": string(metadataJSON),
			}
			_ = rdb.Publish(channel, ssePayload)
		}

		// Send push notification using resolved template title and body
		if s.pushSvc != nil {
			_ = s.pushSvc.SendToUser(ctx, alert.UserID, resolvedTitle, resolvedBody, "/dashboard/settings/alerts")
		}

		// Update alert status and counters
		newTriggerCount := alert.TriggerCount + 1
		if alert.TriggerMode == "once" {
			if err := s.alertRepo.UpdateStatus(ctx, alert.ID, "triggered", &now, newTriggerCount); err != nil {
				log.Printf("EvaluateAlerts: failed to update status for alert %d: %v", alert.ID, err)
				errors++
			}
		} else {
			// Repeat mode: set cooldown, keep status active
			if rdb != nil {
				cooldownKey := fmt.Sprintf("%s%d", alertCooldownKeyPrefix, alert.ID)
				cooldownTTL := time.Duration(alert.CooldownHours) * time.Hour
				rdb.GetClient().Set(ctx, cooldownKey, "1", cooldownTTL)
			}
			if err := s.alertRepo.UpdateStatus(ctx, alert.ID, "active", &now, newTriggerCount); err != nil {
				log.Printf("EvaluateAlerts: failed to update trigger count for alert %d: %v", alert.ID, err)
				errors++
			}
		}

		// Increment daily cap counter
		if rdb != nil {
			dailyKey := fmt.Sprintf("%s%d", alertDailyCapKeyPrefix, alert.UserID)
			pipe := rdb.GetClient().Pipeline()
			pipe.Incr(ctx, dailyKey)
			pipe.Expire(ctx, dailyKey, 24*time.Hour)
			_, _ = pipe.Exec(ctx)
		}

		triggered++
	}

	log.Printf("EvaluateAlerts: total=%d triggered=%d skipped_cooldown=%d skipped_cap=%d errors=%d",
		total, triggered, skippedCooldown, skippedCap, errors)
	return nil
}

// --- helpers ---

// fetchCurrentPrice fetches the current price for a single symbol/assetType combination.
// Returns 0 on error or when price is stale (non-fatal; alert creation still proceeds).
func (s *userPriceAlertService) fetchCurrentPrice(ctx context.Context, symbol, currency string, assetType v1.InvestmentType, priceSide string) int64 {
	fetchCtx, cancel := context.WithTimeout(ctx, alertPriceFetchTimeout)
	defer cancel()

	switch {
	case gold.IsGoldType(assetType):
		dto, err := s.assetPriceSvc.GetPriceByTypeCode(fetchCtx, symbol)
		if err != nil || dto == nil || dto.IsStale {
			if err != nil {
				log.Printf("Warning: DB price lookup failed for %s: %v", symbol, err)
			}
			return 0
		}
		if priceSide == "sell" {
			return dto.Sell
		}
		return dto.Buy

	case silver.IsSilverType(assetType):
		dto, err := s.assetPriceSvc.GetPriceByTypeCode(fetchCtx, symbol)
		if err != nil || dto == nil || dto.IsStale {
			if err != nil {
				log.Printf("Warning: DB price lookup failed for %s: %v", symbol, err)
			}
			return 0
		}
		if priceSide == "sell" {
			return dto.Sell
		}
		return dto.Buy

	default:
		md, err := s.marketDataSvc.GetPrice(fetchCtx, symbol, currency, assetType, 15*time.Minute)
		if err != nil {
			log.Printf("Warning: failed to fetch market price for alert creation (symbol=%s): %v", symbol, err)
			return 0
		}
		return md.Price
	}
}

// fetchPricesForAlerts fetches current prices for a batch of alerts, grouped by asset type
// to minimise external API calls. Returns a map keyed by "symbol|priceSide".
// Stale prices are excluded from the map — callers treat missing entries as "price unavailable".
func (s *userPriceAlertService) fetchPricesForAlerts(ctx context.Context, alerts []*models.UserPriceAlert) map[string]int64 {
	priceMap := make(map[string]int64)
	if len(alerts) == 0 {
		return priceMap
	}

	// Separate alerts by asset type category
	var hasGold, hasSilver bool
	marketAlerts := make([]*models.UserPriceAlert, 0)
	for _, a := range alerts {
		at := v1.InvestmentType(a.AssetType)
		switch {
		case gold.IsGoldType(at):
			hasGold = true
		case silver.IsSilverType(at):
			hasSilver = true
		default:
			marketAlerts = append(marketAlerts, a)
		}
	}

	fetchCtx, cancel := context.WithTimeout(ctx, alertPriceFetchTimeout)
	defer cancel()

	// Fetch gold prices from DB cache (non-stale only)
	var goldByCode map[string]*AssetPriceDTO
	if hasGold {
		prices, err := s.assetPriceSvc.GetPricesByAssetType(fetchCtx, "gold")
		if err != nil {
			log.Printf("Warning: DB gold prices unavailable for alerts: %v", err)
		} else {
			goldByCode = make(map[string]*AssetPriceDTO, len(prices))
			for _, p := range prices {
				if !p.IsStale {
					goldByCode[p.TypeCode] = p
				}
			}
		}
	}

	// Fetch silver prices from DB cache (non-stale only)
	var silverByCode map[string]*AssetPriceDTO
	if hasSilver {
		prices, err := s.assetPriceSvc.GetPricesByAssetType(fetchCtx, "silver")
		if err != nil {
			log.Printf("Warning: DB silver prices unavailable for alerts: %v", err)
		} else {
			silverByCode = make(map[string]*AssetPriceDTO, len(prices))
			for _, p := range prices {
				if !p.IsStale {
					silverByCode[p.TypeCode] = p
				}
			}
		}
	}

	// Populate price map for each alert
	for _, a := range alerts {
		key := a.Symbol + "|" + a.PriceSide
		at := v1.InvestmentType(a.AssetType)

		switch {
		case gold.IsGoldType(at):
			if goldByCode != nil {
				if gp, ok := goldByCode[a.Symbol]; ok {
					if a.PriceSide == "sell" {
						priceMap[key] = gp.Sell
					} else {
						priceMap[key] = gp.Buy
					}
				}
			}

		case silver.IsSilverType(at):
			if silverByCode != nil {
				if sp, ok := silverByCode[a.Symbol]; ok {
					if a.PriceSide == "sell" {
						priceMap[key] = sp.Sell
					} else {
						priceMap[key] = sp.Buy
					}
				}
			}
		}
	}

	// Fetch market prices individually (Yahoo Finance — kept live, no DB cache for market data)
	for _, a := range marketAlerts {
		key := a.Symbol + "|" + a.PriceSide
		md, err := s.marketDataSvc.GetPrice(fetchCtx, a.Symbol, a.Currency, v1.InvestmentType(a.AssetType), 15*time.Minute)
		if err != nil {
			log.Printf("Warning: failed to fetch market price for alert (symbol=%s): %v", a.Symbol, err)
			continue
		}
		priceMap[key] = md.Price
	}

	return priceMap
}

// buildListOptions converts proto pagination params to repository ListOptions.
func (s *userPriceAlertService) buildListOptions(params *v1.PaginationParams) repository.ListOptions {
	if params == nil {
		return repository.ListOptions{Limit: 20, Offset: 0, OrderBy: "created_at", Order: "desc"}
	}

	page := int(params.GetPage())
	pageSize := int(params.GetPageSize())
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	orderBy := params.GetOrderBy()
	order := params.GetOrder()
	if order != "asc" && order != "desc" {
		order = "desc"
	}
	if orderBy == "" {
		orderBy = "created_at"
	}

	return repository.ListOptions{
		Limit:   pageSize,
		Offset:  (page - 1) * pageSize,
		OrderBy: orderBy,
		Order:   order,
	}
}

// alertDirectionToString converts proto AlertDirection to string for DB storage.
func alertDirectionToString(d v1.AlertDirection) string {
	switch d {
	case v1.AlertDirection_ALERT_DIRECTION_ABOVE:
		return "above"
	case v1.AlertDirection_ALERT_DIRECTION_BELOW:
		return "below"
	default:
		return ""
	}
}

// alertTriggerModeToString converts proto AlertTriggerMode to string for DB storage.
func alertTriggerModeToString(m v1.AlertTriggerMode) string {
	switch m {
	case v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE:
		return "once"
	case v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT:
		return "repeat"
	default:
		return ""
	}
}

// alertStatusToString converts proto AlertStatus to string for DB storage / filtering.
func alertStatusToString(s v1.AlertStatus) string {
	switch s {
	case v1.AlertStatus_ALERT_STATUS_ACTIVE:
		return "active"
	case v1.AlertStatus_ALERT_STATUS_TRIGGERED:
		return "triggered"
	case v1.AlertStatus_ALERT_STATUS_PAUSED:
		return "paused"
	default:
		return ""
	}
}
