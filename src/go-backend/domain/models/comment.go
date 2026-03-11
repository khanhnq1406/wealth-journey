package models

import (
	"time"

	"gorm.io/gorm"
)

// Comment represents a comment on a community post
type Comment struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID    int32          `gorm:"not null;index:idx_comment_post_id" json:"postId"`
	UserID    int32          `gorm:"not null;index:idx_comment_user_id" json:"userId"`
	Content         string         `gorm:"type:text;not null" json:"content"`
	ParentCommentID *int32         `gorm:"index:idx_comment_parent_id" json:"parentCommentId,omitempty"`
	ReplyCount      int32          `gorm:"not null;default:0" json:"replyCount"`
	UpdatedAt       *time.Time     `json:"updatedAt,omitempty"`
	ParentComment   *Comment       `gorm:"foreignKey:ParentCommentID" json:"parentComment,omitempty"`
	CreatedAt time.Time      `json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Post      *Post          `gorm:"foreignKey:PostID" json:"post,omitempty"`
}

// TableName specifies the table name for Comment model
func (Comment) TableName() string {
	return "comment"
}
