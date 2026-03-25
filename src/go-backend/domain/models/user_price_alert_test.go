package models

import (
	"testing"
	"time"

	v1 "wealthjourney/protobuf/v1"
)

func TestUserPriceAlert_ToProto(t *testing.T) {
	now := time.Now().Truncate(time.Second)
	lastTriggered := now.Add(-1 * time.Hour)

	alert := &UserPriceAlert{
		ID:                     42,
		UserID:                 7,
		Symbol:                 "AAPL",
		Name:                   "Apple Inc.",
		AssetType:              int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Currency:               "USD",
		PriceSide:              "buy",
		Direction:              "above",
		TargetPrice:            20000000, // 200.00 USD in cents
		TriggerMode:            "once",
		CooldownHours:          4,
		Status:                 "active",
		Note:                   "Test alert",
		LastTriggeredAt:        &lastTriggered,
		TriggerCount:           2,
		CurrentPriceAtCreation: 19500000,
		CreatedAt:              now,
		UpdatedAt:              now,
	}

	proto := alert.ToProto()

	if proto.Id != 42 {
		t.Errorf("expected Id=42, got %d", proto.Id)
	}
	if proto.UserId != 7 {
		t.Errorf("expected UserId=7, got %d", proto.UserId)
	}
	if proto.Symbol != "AAPL" {
		t.Errorf("expected Symbol=AAPL, got %s", proto.Symbol)
	}
	if proto.Name != "Apple Inc." {
		t.Errorf("expected Name=Apple Inc., got %s", proto.Name)
	}
	if proto.AssetType != v1.InvestmentType_INVESTMENT_TYPE_STOCK {
		t.Errorf("expected AssetType=STOCK, got %v", proto.AssetType)
	}
	if proto.Currency != "USD" {
		t.Errorf("expected Currency=USD, got %s", proto.Currency)
	}
	if proto.PriceSide != "buy" {
		t.Errorf("expected PriceSide=buy, got %s", proto.PriceSide)
	}
	if proto.Direction != v1.AlertDirection_ALERT_DIRECTION_ABOVE {
		t.Errorf("expected Direction=ABOVE, got %v", proto.Direction)
	}
	if proto.TargetPrice != 20000000 {
		t.Errorf("expected TargetPrice=20000000, got %d", proto.TargetPrice)
	}
	if proto.TriggerMode != v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE {
		t.Errorf("expected TriggerMode=ONCE, got %v", proto.TriggerMode)
	}
	if proto.CooldownHours != 4 {
		t.Errorf("expected CooldownHours=4, got %d", proto.CooldownHours)
	}
	if proto.Status != v1.AlertStatus_ALERT_STATUS_ACTIVE {
		t.Errorf("expected Status=ACTIVE, got %v", proto.Status)
	}
	if proto.Note != "Test alert" {
		t.Errorf("expected Note='Test alert', got %s", proto.Note)
	}
	if proto.LastTriggeredAt != lastTriggered.Unix() {
		t.Errorf("expected LastTriggeredAt=%d, got %d", lastTriggered.Unix(), proto.LastTriggeredAt)
	}
	if proto.TriggerCount != 2 {
		t.Errorf("expected TriggerCount=2, got %d", proto.TriggerCount)
	}
	if proto.CurrentPriceAtCreation != 19500000 {
		t.Errorf("expected CurrentPriceAtCreation=19500000, got %d", proto.CurrentPriceAtCreation)
	}
	if proto.CreatedAt != now.Unix() {
		t.Errorf("expected CreatedAt=%d, got %d", now.Unix(), proto.CreatedAt)
	}
}

func TestUserPriceAlert_ToProto_NilLastTriggeredAt(t *testing.T) {
	alert := &UserPriceAlert{
		ID:                     1,
		UserID:                 1,
		Symbol:                 "BTC",
		Name:                   "Bitcoin",
		AssetType:              int32(v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY),
		Currency:               "USD",
		PriceSide:              "buy",
		Direction:              "below",
		TargetPrice:            5000000000,
		TriggerMode:            "repeat",
		CooldownHours:          8,
		Status:                 "paused",
		Note:                   "",
		LastTriggeredAt:        nil,
		TriggerCount:           0,
		CurrentPriceAtCreation: 6000000000,
		CreatedAt:              time.Now(),
	}

	proto := alert.ToProto()

	if proto.LastTriggeredAt != 0 {
		t.Errorf("expected LastTriggeredAt=0 for nil pointer, got %d", proto.LastTriggeredAt)
	}
	if proto.Direction != v1.AlertDirection_ALERT_DIRECTION_BELOW {
		t.Errorf("expected Direction=BELOW, got %v", proto.Direction)
	}
	if proto.TriggerMode != v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT {
		t.Errorf("expected TriggerMode=REPEAT, got %v", proto.TriggerMode)
	}
	if proto.Status != v1.AlertStatus_ALERT_STATUS_PAUSED {
		t.Errorf("expected Status=PAUSED, got %v", proto.Status)
	}
}

func TestUserPriceAlert_ToProto_TriggeredStatus(t *testing.T) {
	triggered := time.Now().Add(-30 * time.Minute)
	alert := &UserPriceAlert{
		ID:                     5,
		UserID:                 3,
		Symbol:                 "VCB",
		Name:                   "Vietcombank",
		AssetType:              int32(v1.InvestmentType_INVESTMENT_TYPE_STOCK),
		Currency:               "VND",
		PriceSide:              "buy",
		Direction:              "above",
		TargetPrice:            9000000,
		TriggerMode:            "once",
		CooldownHours:          4,
		Status:                 "triggered",
		LastTriggeredAt:        &triggered,
		TriggerCount:           1,
		CurrentPriceAtCreation: 8500000,
		CreatedAt:              time.Now().Add(-24 * time.Hour),
	}

	proto := alert.ToProto()

	if proto.Status != v1.AlertStatus_ALERT_STATUS_TRIGGERED {
		t.Errorf("expected Status=TRIGGERED, got %v", proto.Status)
	}
	if proto.LastTriggeredAt != triggered.Unix() {
		t.Errorf("expected LastTriggeredAt=%d, got %d", triggered.Unix(), proto.LastTriggeredAt)
	}
	if proto.TriggerCount != 1 {
		t.Errorf("expected TriggerCount=1, got %d", proto.TriggerCount)
	}
}

func TestAlertDirectionToProto(t *testing.T) {
	tests := []struct {
		input    string
		expected v1.AlertDirection
	}{
		{"above", v1.AlertDirection_ALERT_DIRECTION_ABOVE},
		{"below", v1.AlertDirection_ALERT_DIRECTION_BELOW},
		{"", v1.AlertDirection_ALERT_DIRECTION_UNSPECIFIED},
		{"unknown", v1.AlertDirection_ALERT_DIRECTION_UNSPECIFIED},
	}

	for _, tt := range tests {
		result := alertDirectionToProto(tt.input)
		if result != tt.expected {
			t.Errorf("alertDirectionToProto(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestAlertTriggerModeToProto(t *testing.T) {
	tests := []struct {
		input    string
		expected v1.AlertTriggerMode
	}{
		{"once", v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE},
		{"repeat", v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT},
		{"", v1.AlertTriggerMode_ALERT_TRIGGER_MODE_UNSPECIFIED},
		{"unknown", v1.AlertTriggerMode_ALERT_TRIGGER_MODE_UNSPECIFIED},
	}

	for _, tt := range tests {
		result := alertTriggerModeToProto(tt.input)
		if result != tt.expected {
			t.Errorf("alertTriggerModeToProto(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}

func TestAlertStatusToProto(t *testing.T) {
	tests := []struct {
		input    string
		expected v1.AlertStatus
	}{
		{"active", v1.AlertStatus_ALERT_STATUS_ACTIVE},
		{"triggered", v1.AlertStatus_ALERT_STATUS_TRIGGERED},
		{"paused", v1.AlertStatus_ALERT_STATUS_PAUSED},
		{"", v1.AlertStatus_ALERT_STATUS_UNSPECIFIED},
		{"unknown", v1.AlertStatus_ALERT_STATUS_UNSPECIFIED},
	}

	for _, tt := range tests {
		result := alertStatusToProto(tt.input)
		if result != tt.expected {
			t.Errorf("alertStatusToProto(%q) = %v, want %v", tt.input, result, tt.expected)
		}
	}
}
