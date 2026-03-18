package models

import "time"

// SiteSetting stores editable CMS content as key-value pairs.
type SiteSetting struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	Key       string    `gorm:"size:100;uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	UpdatedBy *int32    `gorm:"index" json:"updatedBy"`
	UpdatedAt time.Time `json:"updatedAt"`
	CreatedAt time.Time `json:"createdAt"`
}

func (SiteSetting) TableName() string {
	return "site_settings"
}
