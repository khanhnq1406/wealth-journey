package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"

	"gorm.io/gorm/clause"
)

// SiteSettingsRepository defines the interface for site settings data access.
type SiteSettingsRepository interface {
	GetAll(ctx context.Context) ([]*models.SiteSetting, error)
	GetByKey(ctx context.Context, key string) (*models.SiteSetting, error)
	BulkUpsert(ctx context.Context, settings []*models.SiteSetting) error
}

type siteSettingsRepository struct {
	*BaseRepository
}

// NewSiteSettingsRepository creates a new site settings repository.
func NewSiteSettingsRepository(db *database.Database) SiteSettingsRepository {
	return &siteSettingsRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *siteSettingsRepository) GetAll(ctx context.Context) ([]*models.SiteSetting, error) {
	var settings []*models.SiteSetting
	result := r.db.DB.WithContext(ctx).Order("key ASC").Find(&settings)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "site_settings", "list site settings")
	}
	return settings, nil
}

func (r *siteSettingsRepository) GetByKey(ctx context.Context, key string) (*models.SiteSetting, error) {
	var setting models.SiteSetting
	result := r.db.DB.WithContext(ctx).Where("key = ?", key).First(&setting)
	if result.Error != nil {
		return nil, r.handleDBError(result.Error, "site_setting", "get site setting by key")
	}
	return &setting, nil
}

func (r *siteSettingsRepository) BulkUpsert(ctx context.Context, settings []*models.SiteSetting) error {
	if len(settings) == 0 {
		return nil
	}

	result := r.db.DB.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "key"}},
			DoUpdates: clause.AssignmentColumns([]string{"value", "updated_by", "updated_at"}),
		}).
		Create(&settings)

	return r.handleDBError(result.Error, "site_settings", "bulk upsert site settings")
}
