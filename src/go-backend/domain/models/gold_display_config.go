package models

import (
	"time"

	"gorm.io/gorm"
)

type GoldDisplayConfig struct {
	ID               int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	TypeCode         string         `gorm:"size:50;not null;uniqueIndex:idx_gold_display_config_type_code" json:"typeCode"`
	DisplayName      string         `gorm:"size:100;not null" json:"displayName"`
	DisplayOrder     int32          `gorm:"not null;default:0" json:"displayOrder"`
	Enabled          bool           `gorm:"not null;default:true" json:"enabled"`
	ShowInInvestment bool           `gorm:"not null;default:true" json:"showInInvestment"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (GoldDisplayConfig) TableName() string {
	return "gold_display_config"
}
