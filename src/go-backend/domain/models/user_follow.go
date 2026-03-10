package models

import "time"

// UserFollow represents a follow relationship between users
type UserFollow struct {
	ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	FollowerID  int32     `gorm:"not null;uniqueIndex:idx_follow_follower_following" json:"followerId"`
	FollowingID int32     `gorm:"not null;uniqueIndex:idx_follow_follower_following;index:idx_follow_following_id" json:"followingId"`
	CreatedAt   time.Time `json:"createdAt"`
}

// TableName specifies the table name for UserFollow model
func (UserFollow) TableName() string {
	return "user_follow"
}
