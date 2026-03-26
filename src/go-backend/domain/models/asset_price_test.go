package models_test

import (
	"testing"
	"time"

	"wealthjourney/domain/models"
)

func TestAssetPrice_TableName(t *testing.T) {
	ap := &models.AssetPrice{}
	if ap.TableName() != "asset_price" {
		t.Errorf("expected table name 'asset_price', got '%s'", ap.TableName())
	}
}

func TestAssetPrice_FieldTypes(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	fetchedAt := now.Add(-5 * time.Minute)

	ap := &models.AssetPrice{
		ID:         1,
		TypeCode:   "SJC_1L",
		AssetType:  "gold",
		Name:       "SJC 1 Luong",
		Buy:        8250000000,
		Sell:       8270000000,
		ChangeBuy:  50000000,
		ChangeSell: 50000000,
		Currency:   "VND",
		Source:     "vang.today",
		IsStale:    false,
		FetchedAt:  fetchedAt,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	// Verify ID is int32
	var _ int32 = ap.ID

	// Verify monetary fields are int64
	var _ int64 = ap.Buy
	var _ int64 = ap.Sell
	var _ int64 = ap.ChangeBuy
	var _ int64 = ap.ChangeSell

	// Verify string fields
	if ap.TypeCode != "SJC_1L" {
		t.Errorf("expected TypeCode='SJC_1L', got '%s'", ap.TypeCode)
	}
	if ap.AssetType != "gold" {
		t.Errorf("expected AssetType='gold', got '%s'", ap.AssetType)
	}
	if ap.Name != "SJC 1 Luong" {
		t.Errorf("expected Name='SJC 1 Luong', got '%s'", ap.Name)
	}
	if ap.Currency != "VND" {
		t.Errorf("expected Currency='VND', got '%s'", ap.Currency)
	}
	if ap.Source != "vang.today" {
		t.Errorf("expected Source='vang.today', got '%s'", ap.Source)
	}

	// Verify bool field
	if ap.IsStale != false {
		t.Errorf("expected IsStale=false, got %v", ap.IsStale)
	}

	// Verify time fields
	if ap.FetchedAt != fetchedAt {
		t.Errorf("expected FetchedAt=%v, got %v", fetchedAt, ap.FetchedAt)
	}
	if ap.CreatedAt != now {
		t.Errorf("expected CreatedAt=%v, got %v", now, ap.CreatedAt)
	}
	if ap.UpdatedAt != now {
		t.Errorf("expected UpdatedAt=%v, got %v", now, ap.UpdatedAt)
	}
}

func TestAssetPrice_IsStaleFlag(t *testing.T) {
	// Verify IsStale can be set to true (representing stale cache entries)
	ap := &models.AssetPrice{
		TypeCode:  "XAU",
		AssetType: "gold",
		Name:      "World Gold",
		Currency:  "USD",
		IsStale:   true,
		FetchedAt: time.Now().Add(-2 * time.Hour),
	}

	if !ap.IsStale {
		t.Errorf("expected IsStale=true, got false")
	}
}

func TestAssetPrice_ZeroMonetaryValues(t *testing.T) {
	// Verify zero values are valid for monetary fields (default:0 in GORM tag)
	ap := &models.AssetPrice{
		TypeCode:   "BTMC_24K",
		AssetType:  "gold",
		Name:       "BTMC 24K",
		Currency:   "VND",
		Buy:        0,
		Sell:       0,
		ChangeBuy:  0,
		ChangeSell: 0,
		IsStale:    true,
		FetchedAt:  time.Now(),
	}

	if ap.Buy != 0 {
		t.Errorf("expected Buy=0, got %d", ap.Buy)
	}
	if ap.Sell != 0 {
		t.Errorf("expected Sell=0, got %d", ap.Sell)
	}
	if ap.ChangeBuy != 0 {
		t.Errorf("expected ChangeBuy=0, got %d", ap.ChangeBuy)
	}
	if ap.ChangeSell != 0 {
		t.Errorf("expected ChangeSell=0, got %d", ap.ChangeSell)
	}
}

func TestAssetPrice_SilverAssetType(t *testing.T) {
	// Verify silver assets use the same model (AssetType distinguishes them)
	ap := &models.AssetPrice{
		TypeCode:  "SILVER_VND",
		AssetType: "silver",
		Name:      "Silver VND",
		Buy:       920000000,
		Sell:      960000000,
		Currency:  "VND",
		Source:    "silver-api",
		IsStale:   false,
		FetchedAt: time.Now(),
	}

	if ap.AssetType != "silver" {
		t.Errorf("expected AssetType='silver', got '%s'", ap.AssetType)
	}
	if ap.Buy != 920000000 {
		t.Errorf("expected Buy=920000000, got %d", ap.Buy)
	}
	if ap.Sell != 960000000 {
		t.Errorf("expected Sell=960000000, got %d", ap.Sell)
	}
}
