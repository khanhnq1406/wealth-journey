package models

import (
	"time"

	v1 "wealthjourney/protobuf/v1"

	"gorm.io/gorm"
)

// UserPriceAlert represents a user-configured price alert for a given symbol/asset.
type UserPriceAlert struct {
	ID                     int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID                 int32          `gorm:"not null;index:idx_user_price_alert_user_status" json:"userId"`
	Symbol                 string         `gorm:"size:50;not null;index:idx_user_price_alert_symbol" json:"symbol"`
	Name                   string         `gorm:"size:200;not null" json:"name"`
	AssetType              int32          `gorm:"not null" json:"assetType"`
	Currency               string         `gorm:"size:3;not null" json:"currency"`
	PriceSide              string         `gorm:"size:4;not null;default:'buy'" json:"priceSide"`
	Direction              string         `gorm:"size:5;not null" json:"direction"`
	TargetPrice            int64          `gorm:"type:bigint;not null" json:"targetPrice"`
	TriggerMode            string         `gorm:"size:10;not null;default:'once'" json:"triggerMode"`
	CooldownHours          int32          `gorm:"default:4" json:"cooldownHours"`
	Status                 string         `gorm:"size:10;not null;default:'active';index:idx_user_price_alert_user_status;index:idx_user_price_alert_status" json:"status"`
	Note                   string         `gorm:"size:200" json:"note"`
	LastTriggeredAt        *time.Time     `json:"lastTriggeredAt"`
	TriggerCount           int32          `gorm:"default:0" json:"triggerCount"`
	CurrentPriceAtCreation int64          `gorm:"type:bigint;not null" json:"currentPriceAtCreation"`
	CreatedAt              time.Time      `json:"createdAt"`
	UpdatedAt              time.Time      `json:"updatedAt"`
	DeletedAt              gorm.DeletedAt `gorm:"index" json:"-"`
	User                   *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName specifies the database table name for UserPriceAlert.
func (UserPriceAlert) TableName() string {
	return "user_price_alert"
}

// ToProto converts the model to its protobuf representation.
func (a *UserPriceAlert) ToProto() *v1.UserPriceAlert {
	var lastTriggeredAt int64
	if a.LastTriggeredAt != nil {
		lastTriggeredAt = a.LastTriggeredAt.Unix()
	}

	return &v1.UserPriceAlert{
		Id:                     a.ID,
		UserId:                 a.UserID,
		Symbol:                 a.Symbol,
		Name:                   a.Name,
		AssetType:              v1.InvestmentType(a.AssetType),
		Currency:               a.Currency,
		PriceSide:              a.PriceSide,
		Direction:              alertDirectionToProto(a.Direction),
		TargetPrice:            a.TargetPrice,
		TriggerMode:            alertTriggerModeToProto(a.TriggerMode),
		CooldownHours:          a.CooldownHours,
		Status:                 alertStatusToProto(a.Status),
		Note:                   a.Note,
		LastTriggeredAt:        lastTriggeredAt,
		TriggerCount:           a.TriggerCount,
		CurrentPriceAtCreation: a.CurrentPriceAtCreation,
		CreatedAt:              a.CreatedAt.Unix(),
	}
}

// alertDirectionToProto converts a string direction to the proto enum.
func alertDirectionToProto(direction string) v1.AlertDirection {
	switch direction {
	case "above":
		return v1.AlertDirection_ALERT_DIRECTION_ABOVE
	case "below":
		return v1.AlertDirection_ALERT_DIRECTION_BELOW
	default:
		return v1.AlertDirection_ALERT_DIRECTION_UNSPECIFIED
	}
}

// alertTriggerModeToProto converts a string trigger mode to the proto enum.
func alertTriggerModeToProto(mode string) v1.AlertTriggerMode {
	switch mode {
	case "once":
		return v1.AlertTriggerMode_ALERT_TRIGGER_MODE_ONCE
	case "repeat":
		return v1.AlertTriggerMode_ALERT_TRIGGER_MODE_REPEAT
	default:
		return v1.AlertTriggerMode_ALERT_TRIGGER_MODE_UNSPECIFIED
	}
}

// alertStatusToProto converts a string status to the proto enum.
func alertStatusToProto(status string) v1.AlertStatus {
	switch status {
	case "active":
		return v1.AlertStatus_ALERT_STATUS_ACTIVE
	case "triggered":
		return v1.AlertStatus_ALERT_STATUS_TRIGGERED
	case "paused":
		return v1.AlertStatus_ALERT_STATUS_PAUSED
	default:
		return v1.AlertStatus_ALERT_STATUS_UNSPECIFIED
	}
}
