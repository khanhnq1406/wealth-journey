package models

import "time"

// PostLike represents a like on a community post
type PostLike struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32     `gorm:"not null;uniqueIndex:idx_like_user_post" json:"userId"`
	PostID    int32     `gorm:"not null;uniqueIndex:idx_like_user_post;index:idx_like_post_id" json:"postId"`
	CreatedAt time.Time `json:"createdAt"`
}

// TableName specifies the table name for PostLike model
func (PostLike) TableName() string {
	return "post_like"
}
