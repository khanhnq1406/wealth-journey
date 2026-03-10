package models

import "time"

// ContentReport represents a report on community content (post or comment)
type ContentReport struct {
	ID         int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	ReporterID int32     `gorm:"not null;uniqueIndex:idx_report_target" json:"reporterId"`
	TargetType string    `gorm:"size:20;not null;uniqueIndex:idx_report_target" json:"targetType"`
	TargetID   int32     `gorm:"not null;uniqueIndex:idx_report_target" json:"targetId"`
	Reason     string    `gorm:"size:50;not null" json:"reason"`
	Details    string    `gorm:"type:text" json:"details"`
	Status     string    `gorm:"size:20;default:'pending';index:idx_report_status" json:"status"`
	CreatedAt  time.Time `json:"createdAt"`
}

// TableName specifies the table name for ContentReport model
func (ContentReport) TableName() string {
	return "content_report"
}
