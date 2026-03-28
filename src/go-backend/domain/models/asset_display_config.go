package models

import (
	"time"

	"gorm.io/gorm"
)

type AssetDisplayConfig struct {
	ID               int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	TypeCode         string         `gorm:"size:50;not null;uniqueIndex:idx_asset_display_config_type_code_asset_type" json:"typeCode"`
	AssetType        string         `gorm:"size:20;not null;default:'gold';uniqueIndex:idx_asset_display_config_type_code_asset_type" json:"assetType"`
	DisplayName      string         `gorm:"size:100;not null" json:"displayName"`
	DisplayOrder     int32          `gorm:"not null;default:0" json:"displayOrder"`
	Enabled          bool           `gorm:"not null;default:true" json:"enabled"`
	ShowInInvestment bool           `gorm:"not null;default:true" json:"showInInvestment"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
	FetchCodes       []AssetConfigFetchCode `gorm:"foreignKey:ConfigID" json:"fetchCodes,omitempty"`
}

func (AssetDisplayConfig) TableName() string {
	return "asset_display_config"
}
