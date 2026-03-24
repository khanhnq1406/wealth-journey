package models

import (
	"time"

	"gorm.io/gorm"
)

// WatchlistItem represents a user's watchlisted symbol.
type WatchlistItem struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32          `gorm:"not null;index:idx_watchlist_user_id;uniqueIndex:idx_watchlist_user_symbol,where:deleted_at IS NULL" json:"userId"`
	Symbol    string         `gorm:"size:50;not null;uniqueIndex:idx_watchlist_user_symbol,where:deleted_at IS NULL" json:"symbol"`
	Name      string         `gorm:"size:200;not null" json:"name"`
	AssetType int32          `gorm:"column:asset_type;type:int;not null;default:0" json:"assetType"`
	Currency  string         `gorm:"size:3;not null;default:'VND'" json:"currency"`
	Note      string         `gorm:"size:200" json:"note"`
	SortOrder int32          `gorm:"not null;default:0;index:idx_watchlist_user_sort" json:"sortOrder"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName specifies the table name for WatchlistItem model.
func (WatchlistItem) TableName() string {
	return "watchlist"
}
