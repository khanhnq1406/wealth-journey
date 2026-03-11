package models

import "time"

type SavedPost struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32     `gorm:"not null;uniqueIndex:idx_saved_user_post;index:idx_saved_user_created" json:"userId"`
	PostID    int32     `gorm:"not null;uniqueIndex:idx_saved_user_post" json:"postId"`
	CreatedAt time.Time `gorm:"not null;index:idx_saved_user_created" json:"createdAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Post      *Post     `gorm:"foreignKey:PostID" json:"post,omitempty"`
}

func (SavedPost) TableName() string {
	return "saved_post"
}
