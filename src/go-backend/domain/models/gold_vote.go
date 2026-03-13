package models

import "time"

type GoldVote struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int32     `gorm:"not null;uniqueIndex:idx_gold_vote_user_date,priority:1" json:"userId"`
	VoteDate  time.Time `gorm:"type:date;not null;uniqueIndex:idx_gold_vote_user_date,priority:2;index:idx_gold_vote_date" json:"voteDate"`
	Direction int32     `gorm:"type:smallint;not null" json:"direction"` // 1=BULLISH, 2=BEARISH
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GoldVote) TableName() string {
	return "gold_vote"
}
