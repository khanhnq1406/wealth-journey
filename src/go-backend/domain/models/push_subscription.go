package models

import "time"

type PushSubscription struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32     `gorm:"not null;index:idx_push_sub_user_id" json:"userId"`
	Endpoint  string    `gorm:"type:text;not null;uniqueIndex:idx_push_sub_endpoint" json:"endpoint"`
	P256dh    string    `gorm:"type:text;not null" json:"p256dh"`
	Auth      string    `gorm:"type:text;not null" json:"auth"`
	CreatedAt time.Time `gorm:"not null" json:"createdAt"`
	UpdatedAt time.Time `gorm:"not null" json:"updatedAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (PushSubscription) TableName() string {
	return "push_subscription"
}
