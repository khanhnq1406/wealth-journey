package models

import (
	"time"

	"gorm.io/gorm"
)

type GoldVoteComment struct {
	ID        int32          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32          `gorm:"not null;index:idx_gold_vote_comment_user" json:"userId"`
	VoteDate  time.Time      `gorm:"type:date;not null;index:idx_gold_vote_comment_date" json:"voteDate"`
	Content   string         `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time      `json:"createdAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
	User      *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GoldVoteComment) TableName() string {
	return "gold_vote_comment"
}
