package service

import (
	"context"
	"errors"
	"testing"

	"wealthjourney/pkg/mihong"
)

func TestMihongGoldFetcher_Source(t *testing.T) {
	f := newMihongGoldFetcherWithStub(func(ctx context.Context) ([]*mihong.GoldPrice, error) {
		return nil, nil
	})
	if f.Source() != SourceMihong {
		t.Errorf("Source(): want %s, got %s", SourceMihong, f.Source())
	}
}

func TestMihongGoldFetcher_FetchGoldPrices_MapsCorrectly(t *testing.T) {
	stub := func(ctx context.Context) ([]*mihong.GoldPrice, error) {
		return []*mihong.GoldPrice{
			{TypeCode: "Mihong_999", Name: "Mi Hồng 999", Buy: 171_500_000, Sell: 175_000_000, Currency: "VND"},
		}, nil
	}
	f := newMihongGoldFetcherWithStub(stub)
	prices, err := f.FetchGoldPrices(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(prices) != 1 {
		t.Fatalf("expected 1 price, got %d", len(prices))
	}
	p := prices[0]
	if p.TypeCode != "Mihong_999" {
		t.Errorf("TypeCode: want Mihong_999, got %s", p.TypeCode)
	}
	if p.Buy != 171_500_000 {
		t.Errorf("Buy: want 171500000, got %d", p.Buy)
	}
	if p.Currency != "VND" {
		t.Errorf("Currency: want VND, got %s", p.Currency)
	}
	if p.ChangeBuy != 0 {
		t.Errorf("ChangeBuy: want 0, got %d", p.ChangeBuy)
	}
}

func TestMihongGoldFetcher_FetchGoldPrices_PropagatesError(t *testing.T) {
	stub := func(ctx context.Context) ([]*mihong.GoldPrice, error) {
		return nil, errors.New("network error")
	}
	f := newMihongGoldFetcherWithStub(stub)
	_, err := f.FetchGoldPrices(context.Background())
	if err == nil {
		t.Fatal("expected error to be propagated")
	}
}
