package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wealthjourney/pkg/btmc"
)

// ---------------------------------------------------------------------------
// Compile-time interface check
// ---------------------------------------------------------------------------

var _ GoldPriceFetcher = (*btmcGoldFetcher)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// stubBTMCClientForGold is a test double that replaces the real HTTP call.
type stubBTMCClientForGold struct {
	prices []*btmc.GoldPrice
	err    error
}

func (s *stubBTMCClientForGold) fetchGoldPrices(ctx context.Context) ([]*btmc.GoldPrice, error) {
	return s.prices, s.err
}

// ---------------------------------------------------------------------------
// TestBTMCGoldFetcher_Source
// ---------------------------------------------------------------------------

func TestBTMCGoldFetcher_Source(t *testing.T) {
	// Use constructor with stub to avoid real HTTP + API key requirement
	f := newBTMCGoldFetcherWithStub(func(ctx context.Context) ([]*btmc.GoldPrice, error) {
		return nil, nil
	})
	assert.Equal(t, SourceBTMC, f.Source())
}

// ---------------------------------------------------------------------------
// TestBTMCGoldFetcher_NewBTMCGoldFetcher_EmptyAPIKey
// ---------------------------------------------------------------------------

func TestBTMCGoldFetcher_NewBTMCGoldFetcher_EmptyAPIKey(t *testing.T) {
	_, err := NewBTMCGoldFetcher(5*time.Second, "")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "API key")
}

// ---------------------------------------------------------------------------
// TestBTMCGoldFetcher_FetchGoldPrices_Success
// ---------------------------------------------------------------------------

func TestBTMCGoldFetcher_FetchGoldPrices_Success(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubBTMCClientForGold{
		prices: []*btmc.GoldPrice{
			{
				TypeCode:   "SJC",
				Name:       "SJC 1L, 10L, 1KG",
				Buy:        87_050_000, // already normalized by btmc client (VND*1000)
				Sell:       87_550_000,
				Currency:   "VND",
				UpdateTime: now,
			},
		},
	}

	f := newBTMCGoldFetcherWithStub(stub.fetchGoldPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 1)

	p := prices[0]
	assert.Equal(t, "SJC", p.TypeCode)
	assert.Equal(t, "SJC 1L, 10L, 1KG", p.Name)
	assert.Equal(t, int64(87_050_000), p.Buy)
	assert.Equal(t, int64(87_550_000), p.Sell)
	// BTMC has no change data — must be zero
	assert.Equal(t, int64(0), p.ChangeBuy)
	assert.Equal(t, int64(0), p.ChangeSell)
	assert.Equal(t, "VND", p.Currency)
	assert.Equal(t, now, p.UpdateTime)
}

// ---------------------------------------------------------------------------
// TestBTMCGoldFetcher_FetchGoldPrices_ChangeBuyChangeSellAreZero
// ---------------------------------------------------------------------------

func TestBTMCGoldFetcher_FetchGoldPrices_ChangeBuyChangeSellAreZero(t *testing.T) {
	// Explicitly verifies that Chang{Buy,Sell} are always 0 for BTMC entries,
	// since the BTMC API does not provide change data.
	now := time.Now().Truncate(time.Second)

	stub := &stubBTMCClientForGold{
		prices: []*btmc.GoldPrice{
			{TypeCode: "BTMC_ring", Name: "Nhẫn tròn trơn 99.99", Buy: 83_000_000, Sell: 85_000_000, Currency: "VND", UpdateTime: now},
			{TypeCode: "SJC_5chi", Name: "SJC 5 Chỉ", Buy: 45_000_000, Sell: 46_000_000, Currency: "VND", UpdateTime: now},
		},
	}

	f := newBTMCGoldFetcherWithStub(stub.fetchGoldPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	require.Len(t, prices, 2)

	for _, p := range prices {
		assert.Equal(t, int64(0), p.ChangeBuy, "ChangeBuy must be 0 for BTMC entry %s", p.TypeCode)
		assert.Equal(t, int64(0), p.ChangeSell, "ChangeSell must be 0 for BTMC entry %s", p.TypeCode)
	}
}

// ---------------------------------------------------------------------------
// TestBTMCGoldFetcher_FetchGoldPrices_Error
// ---------------------------------------------------------------------------

func TestBTMCGoldFetcher_FetchGoldPrices_Error(t *testing.T) {
	stub := &stubBTMCClientForGold{
		err: errors.New("btmc: connection refused"),
	}

	f := newBTMCGoldFetcherWithStub(stub.fetchGoldPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	assert.Error(t, err)
	assert.Nil(t, prices)
	assert.Contains(t, err.Error(), "fetch from btmc")
}

// ---------------------------------------------------------------------------
// TestBTMCGoldFetcher_FetchGoldPrices_MultipleEntries
// ---------------------------------------------------------------------------

func TestBTMCGoldFetcher_FetchGoldPrices_MultipleEntries(t *testing.T) {
	now := time.Now().Truncate(time.Second)

	stub := &stubBTMCClientForGold{
		prices: []*btmc.GoldPrice{
			{TypeCode: "SJC", Name: "SJC 1L, 10L, 1KG", Buy: 87_050_000, Sell: 87_550_000, Currency: "VND", UpdateTime: now},
			{TypeCode: "BTMC_ring", Name: "Nhẫn BTMC", Buy: 83_000_000, Sell: 84_000_000, Currency: "VND", UpdateTime: now},
			{TypeCode: "BTMC_jewelry", Name: "Nữ trang BTMC", Buy: 80_000_000, Sell: 81_000_000, Currency: "VND", UpdateTime: now},
		},
	}

	f := newBTMCGoldFetcherWithStub(stub.fetchGoldPrices)
	prices, err := f.FetchGoldPrices(context.Background())

	require.NoError(t, err)
	assert.Len(t, prices, 3)

	assert.Equal(t, "SJC", prices[0].TypeCode)
	assert.Equal(t, int64(87_050_000), prices[0].Buy)

	assert.Equal(t, "BTMC_ring", prices[1].TypeCode)
	assert.Equal(t, int64(83_000_000), prices[1].Buy)

	assert.Equal(t, "BTMC_jewelry", prices[2].TypeCode)
	assert.Equal(t, int64(80_000_000), prices[2].Buy)
}
