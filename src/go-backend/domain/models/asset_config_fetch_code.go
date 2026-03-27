package models

import (
	"time"

	"gorm.io/gorm"
)

type AssetConfigFetchCode struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigID  int32          `gorm:"not null;uniqueIndex:idx_asset_config_fetch_code_unique;index:idx_asset_config_fetch_code_config_id" json:"configId"`
	TypeCode  string         `gorm:"size:50;not null;uniqueIndex:idx_asset_config_fetch_code_unique" json:"typeCode"`
	Priority  int32          `gorm:"not null;default:0" json:"priority"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AssetConfigFetchCode) TableName() string {
	return "asset_config_fetch_code"
}
