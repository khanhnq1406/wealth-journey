package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

type reportRepository struct {
	*BaseRepository
}

// NewReportRepository creates a new content report repository
func NewReportRepository(db *database.Database) ReportRepository {
	return &reportRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *reportRepository) Create(ctx context.Context, report *models.ContentReport) error {
	return r.executeCreate(ctx, report, "content report")
}

func (r *reportRepository) ExistsByUser(ctx context.Context, userID int32, targetType string, targetID int32) (bool, error) {
	var count int64
	err := r.db.DB.WithContext(ctx).Model(&models.ContentReport{}).
		Where("reporter_id = ? AND target_type = ? AND target_id = ?", userID, targetType, targetID).
		Count(&count).Error
	if err != nil {
		return false, r.handleDBError(err, "content report", "check report exists")
	}
	return count > 0, nil
}
