package models

import (
	"time"

	"gorm.io/gorm"
)

// AssetPrice caches gold and silver prices fetched from external sources.
// Used by PriceCacheJob to store prices for fast serving without live API calls.
type AssetPrice struct {
	ID         int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	TypeCode   string         `gorm:"size:50;not null;uniqueIndex:idx_asset_price_type_code_currency" json:"typeCode"`
	AssetType  string         `gorm:"size:10;not null;index:idx_asset_price_asset_type" json:"assetType"`
	Name       string         `gorm:"size:100;not null" json:"name"`
	Buy        int64          `gorm:"type:bigint;not null;default:0" json:"buy"`
	Sell       int64          `gorm:"type:bigint;not null;default:0" json:"sell"`
	ChangeBuy  int64          `gorm:"type:bigint;not null;default:0" json:"changeBuy"`
	ChangeSell int64          `gorm:"type:bigint;not null;default:0" json:"changeSell"`
	Currency   string         `gorm:"size:3;not null;uniqueIndex:idx_asset_price_type_code_currency" json:"currency"`
	Source     string         `gorm:"size:30" json:"source"`
	IsStale    bool           `gorm:"not null;default:false" json:"isStale"`
	FetchedAt  time.Time      `gorm:"not null" json:"fetchedAt"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the database table name for AssetPrice.
func (AssetPrice) TableName() string {
	return "asset_price"
}
