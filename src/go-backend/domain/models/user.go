package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID                  int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	Email               string         `gorm:"uniqueIndex;size:100;not null" json:"email"`
	Name                string         `gorm:"size:100" json:"name"`
	Picture             string         `gorm:"size:255" json:"picture"`
	CreatedAt           time.Time      `json:"createdAt"`
	UpdatedAt           time.Time      `json:"updatedAt"`
	DeletedAt           gorm.DeletedAt `gorm:"index" json:"-"`
	PreferredCurrency   string         `gorm:"size:3;not null;default:'VND';index" json:"preferredCurrency"`
	ConversionInProgress bool          `gorm:"default:false;index" json:"conversionInProgress"`
	PreferredLanguage    string         `gorm:"size:5;not null;default:'vi'" json:"preferredLanguage"`
	Bio                  string         `gorm:"size:200" json:"bio"`
	CoverPhotoURL string `gorm:"size:500" json:"coverPhotoUrl"`
	Location      string `gorm:"size:100" json:"location"`
	Website       string `gorm:"size:200" json:"website"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "user"
}
