package models

import "time"

type PostHashtag struct {
	ID        int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID    int32     `gorm:"not null;uniqueIndex:idx_hashtag_unique;index:idx_hashtag_post" json:"postId"`
	Hashtag   string    `gorm:"type:varchar(100);not null;uniqueIndex:idx_hashtag_unique;index:idx_hashtag_tag_created" json:"hashtag"`
	CreatedAt time.Time `gorm:"not null;index:idx_hashtag_tag_created" json:"createdAt"`
}

func (PostHashtag) TableName() string {
	return "post_hashtag"
}
