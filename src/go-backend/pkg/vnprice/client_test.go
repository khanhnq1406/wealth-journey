package vnprice

import (
	"context"
	"testing"
	"time"
)

func TestClient_FetchPrices(t *testing.T) {
	client := NewClient(10 * time.Second)
	ctx := context.Background()

	prices, err := client.FetchPrices(ctx)
	if err != nil {
		t.Fatalf("FetchPrices failed: %v", err)
	}

	if prices == nil {
		t.Fatal("Expected prices, got nil")
	}

	if len(prices.GoldPrices) == 0 {
		t.Error("Expected gold prices, got empty")
	}

	if len(prices.SilverPrices) == 0 {
		t.Error("Expected silver prices, got empty")
	}

	foundXAUUSD := false
	for _, gp := range prices.GoldPrices {
		if gp.Name == "XAUUSD" {
			foundXAUUSD = true
			if gp.Buy <= 0 {
				t.Errorf("XAUUSD buy price should be > 0, got %f", gp.Buy)
			}
			if gp.Currency != "USD" {
				t.Errorf("XAUUSD currency should be USD, got %s", gp.Currency)
			}
		}
	}
	if !foundXAUUSD {
		t.Error("Expected XAUUSD in gold prices")
	}
}
