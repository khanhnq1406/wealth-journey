package mihong

import (
	"encoding/json"
	"testing"
)

func TestGoldPriceResponse_Unmarshal(t *testing.T) {
	raw := `[{"buyingPrice":17150000,"sellingPrice":17500000,"code":"999","dateTime":"25/03/2026 13:23","sellChange":0,"buyChange":0,"buyChangePercent":0,"sellChangePercent":0}]`
	var resp []GoldPriceResponse
	if err := json.Unmarshal([]byte(raw), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(resp))
	}
	if resp[0].Code != "999" {
		t.Errorf("code: want 999, got %s", resp[0].Code)
	}
	if resp[0].BuyingPrice != 17_150_000 {
		t.Errorf("buyingPrice: want 17150000, got %f", resp[0].BuyingPrice)
	}
}
