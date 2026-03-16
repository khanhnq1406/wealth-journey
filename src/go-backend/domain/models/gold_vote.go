package models

import "time"

type GoldVote struct {
	ID          int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      *int32    `gorm:"index:idx_gold_vote_date" json:"userId"`
	AnonymousID *string   `gorm:"size:36" json:"anonymousId,omitempty"`
	VoteDate    time.Time `gorm:"type:date;not null;index:idx_gold_vote_date" json:"voteDate"`
	Direction   int32     `gorm:"type:smallint;not null" json:"direction"`  // 1=BULLISH, 2=BEARISH
	Category    int32     `gorm:"type:smallint;default:0;not null" json:"category"` // 0=gold, 1=silver
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
	User        *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (GoldVote) TableName() string {
	return "gold_vote"
}
