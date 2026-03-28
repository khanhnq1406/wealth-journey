package scheduler

import (
	"context"
	"errors"
	"testing"
	"time"

	"wealthjourney/domain/service"
)

// ---------------------------------------------------------------------------
// Mock: AssetPriceService
// ---------------------------------------------------------------------------

type mockAssetPriceService struct {
	refreshErr    error
	refreshCalled bool
}

func (m *mockAssetPriceService) RefreshAllPrices(_ context.Context) error {
	m.refreshCalled = true
	return m.refreshErr
}

func (m *mockAssetPriceService) GetAllPrices(_ context.Context) (*service.AllAssetPrices, error) {
	return &service.AllAssetPrices{}, nil
}

func (m *mockAssetPriceService) GetPricesByAssetType(_ context.Context, _ string) ([]*service.AssetPriceDTO, error) {
	return nil, nil
}

func (m *mockAssetPriceService) GetMarketTypes(_ context.Context) (*service.MarketTypesDTO, error) {
	return &service.MarketTypesDTO{}, nil
}

func (m *mockAssetPriceService) GetPriceByTypeCode(_ context.Context, _ string) (*service.AssetPriceDTO, error) {
	return nil, nil
}

// ---------------------------------------------------------------------------
// Tests: PriceCacheJob
// ---------------------------------------------------------------------------

func TestPriceCacheJob_Name(t *testing.T) {
	svc := &mockAssetPriceService{}
	job := NewPriceCacheJob(svc)

	if got := job.Name(); got != "price-cache" {
		t.Errorf("Name() = %q, want %q", got, "price-cache")
	}
}

func TestPriceCacheJob_Interval(t *testing.T) {
	svc := &mockAssetPriceService{}
	job := NewPriceCacheJob(svc)

	if got := job.Interval(); got != 15*time.Minute {
		t.Errorf("Interval() = %v, want %v", got, 15*time.Minute)
	}
}

func TestPriceCacheJob_StartupDelay(t *testing.T) {
	svc := &mockAssetPriceService{}
	job := NewPriceCacheJob(svc)

	if got := job.StartupDelay(); got != 10*time.Second {
		t.Errorf("StartupDelay() = %v, want %v", got, 10*time.Second)
	}
}

func TestPriceCacheJob_Run_CallsRefreshAllPrices(t *testing.T) {
	svc := &mockAssetPriceService{}
	job := NewPriceCacheJob(svc)

	if err := job.Run(context.Background()); err != nil {
		t.Fatalf("Run() unexpected error: %v", err)
	}

	if !svc.refreshCalled {
		t.Error("Run() did not call RefreshAllPrices")
	}
}

func TestPriceCacheJob_Run_PropagatesError(t *testing.T) {
	want := errors.New("price fetch failed")
	svc := &mockAssetPriceService{refreshErr: want}
	job := NewPriceCacheJob(svc)

	got := job.Run(context.Background())
	if got == nil {
		t.Fatal("Run() expected error, got nil")
	}
	if got.Error() != want.Error() {
		t.Errorf("Run() error = %v, want %v", got, want)
	}
}

func TestPriceCacheJob_ImplementsJobInterface(t *testing.T) {
	svc := &mockAssetPriceService{}
	job := NewPriceCacheJob(svc)

	// Compile-time check — if PriceCacheJob does not implement Job, this assignment fails.
	var _ Job = job
}
