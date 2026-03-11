package models

import (
	"time"

	"gorm.io/gorm"
)

// Post represents a community post
type Post struct {
	ID           int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       int32          `gorm:"not null;index:idx_post_user_id" json:"userId"`
	Content      string         `gorm:"type:text;not null" json:"content"`
	ImageURL     string         `gorm:"size:500" json:"imageUrl"`
	LikeCount    int32          `gorm:"default:0" json:"likeCount"`
	CommentCount int32          `gorm:"default:0" json:"commentCount"`
	SharedPostID *int32         `gorm:"index:idx_post_shared" json:"sharedPostId,omitempty"`
	ShareCount   int32          `gorm:"type:int;default:0;not null" json:"shareCount"`
	CreatedAt    time.Time      `gorm:"index:idx_post_created_at" json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index:idx_post_deleted_at" json:"-"`
	User         *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	SharedPost   *Post          `gorm:"foreignKey:SharedPostID" json:"sharedPost,omitempty"`
}

// TableName specifies the table name for Post model
func (Post) TableName() string {
	return "post"
}
