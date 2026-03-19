package models

import (
	"time"

	"gorm.io/datatypes"
)

type Notification struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32          `gorm:"not null;index:idx_notif_user_read_created;index:idx_notif_user_created" json:"userId"`
	ActorID   int32          `gorm:"not null" json:"actorId"`
	Type      string         `gorm:"type:varchar(20);not null" json:"type"` // like, comment, follow, share, price_alert, admin_broadcast
	PostID    *int32         `gorm:"index" json:"postId,omitempty"`         // NULL for follow type
	IsRead    bool           `gorm:"not null;default:false;index:idx_notif_user_read_created" json:"isRead"`
	Metadata  datatypes.JSON `gorm:"type:jsonb" json:"metadata,omitempty"`
	CreatedAt time.Time      `gorm:"not null;index:idx_notif_user_read_created;index:idx_notif_user_created" json:"createdAt"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Actor     *User          `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
}

func (Notification) TableName() string {
	return "notification"
}
