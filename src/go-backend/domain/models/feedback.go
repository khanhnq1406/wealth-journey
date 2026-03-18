package models

import (
	"time"

	"gorm.io/gorm"
)

type Feedback struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32          `gorm:"not null;index:idx_feedback_user_id" json:"userId"`
	Subject   string         `gorm:"size:200;not null" json:"subject"`
	Message   string         `gorm:"type:text;not null" json:"message"`
	Status    int16          `gorm:"type:smallint;not null;default:1" json:"status"` // 1=pending, 2=reviewed, 3=resolved
	CreatedAt time.Time      `gorm:"index:idx_feedback_created_at" json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Feedback) TableName() string {
	return "feedback"
}
