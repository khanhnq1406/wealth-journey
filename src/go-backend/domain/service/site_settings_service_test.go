package service

import (
	"context"
	"testing"

	"wealthjourney/domain/models"

	"github.com/stretchr/testify/assert"
)

// mockSiteSettingsRepo is a mock implementation of SiteSettingsRepository.
type mockSiteSettingsRepo struct {
	getAllFunc    func(ctx context.Context) ([]*models.SiteSetting, error)
	getByKeyFunc func(ctx context.Context, key string) (*models.SiteSetting, error)
	bulkUpsertFunc func(ctx context.Context, settings []*models.SiteSetting) error
}

func (m *mockSiteSettingsRepo) GetAll(ctx context.Context) ([]*models.SiteSetting, error) {
	if m.getAllFunc != nil {
		return m.getAllFunc(ctx)
	}
	return nil, nil
}

func (m *mockSiteSettingsRepo) GetByKey(ctx context.Context, key string) (*models.SiteSetting, error) {
	if m.getByKeyFunc != nil {
		return m.getByKeyFunc(ctx, key)
	}
	return nil, nil
}

func (m *mockSiteSettingsRepo) BulkUpsert(ctx context.Context, settings []*models.SiteSetting) error {
	if m.bulkUpsertFunc != nil {
		return m.bulkUpsertFunc(ctx, settings)
	}
	return nil
}

func TestSiteSettingsService_GetAll_FromRepo(t *testing.T) {
	expected := []*models.SiteSetting{
		{Key: "seo.title", Value: "Test Title"},
		{Key: "footer.brand_name", Value: "Test Brand"},
	}

	repo := &mockSiteSettingsRepo{
		getAllFunc: func(ctx context.Context) ([]*models.SiteSetting, error) {
			return expected, nil
		},
	}

	svc := NewSiteSettingsService(repo, nil) // no cache
	result, err := svc.GetAll(context.Background())

	assert.NoError(t, err)
	assert.Equal(t, 2, len(result))
	assert.Equal(t, "seo.title", result[0].Key)
}

func TestSiteSettingsService_UpdateSettings_Valid(t *testing.T) {
	var upserted []*models.SiteSetting

	repo := &mockSiteSettingsRepo{
		bulkUpsertFunc: func(ctx context.Context, settings []*models.SiteSetting) error {
			upserted = settings
			return nil
		},
		getAllFunc: func(ctx context.Context) ([]*models.SiteSetting, error) {
			return upserted, nil
		},
	}

	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.title", Value: "New Title"},
		{Key: "footer.brand_name", Value: "New Brand"},
	}

	result, err := svc.UpdateSettings(context.Background(), 1, input)

	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, 2, len(result))
	// Verify audit fields were set
	assert.NotNil(t, upserted[0].UpdatedBy)
	assert.Equal(t, int32(1), *upserted[0].UpdatedBy)
}

func TestSiteSettingsService_UpdateSettings_InvalidKey(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "invalid.key", Value: "some value"},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid setting key")
}

func TestSiteSettingsService_UpdateSettings_EmptyValue(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.title", Value: ""},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cannot be empty")
}

func TestSiteSettingsService_UpdateSettings_ValueTooLong(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	longValue := make([]byte, 5001)
	for i := range longValue {
		longValue[i] = 'a'
	}

	input := []*models.SiteSetting{
		{Key: "seo.title", Value: string(longValue)},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "exceeds 5000 characters")
}

func TestSiteSettingsService_UpdateSettings_InvalidKeywordsJSON(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.keywords", Value: "not valid json"},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "valid JSON array")
}

func TestSiteSettingsService_UpdateSettings_ValidKeywordsJSON(t *testing.T) {
	var upserted []*models.SiteSetting

	repo := &mockSiteSettingsRepo{
		bulkUpsertFunc: func(ctx context.Context, s []*models.SiteSetting) error {
			upserted = s
			return nil
		},
		getAllFunc: func(ctx context.Context) ([]*models.SiteSetting, error) {
			return upserted, nil
		},
	}

	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.keywords", Value: `["keyword1","keyword2"]`},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.NoError(t, err)
}

func TestSiteSettingsService_UpdateSettings_InvalidRobotsIndex(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.robots_index", Value: "yes"},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "'true' or 'false'")
}

func TestSiteSettingsService_UpdateSettings_InvalidTwitterCard(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.twitter_card", Value: "invalid_card"},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "'summary' or 'summary_large_image'")
}

func TestSiteSettingsService_UpdateSettings_StripsHTMLTags(t *testing.T) {
	var upserted []*models.SiteSetting

	repo := &mockSiteSettingsRepo{
		bulkUpsertFunc: func(ctx context.Context, settings []*models.SiteSetting) error {
			upserted = settings
			return nil
		},
		getAllFunc: func(ctx context.Context) ([]*models.SiteSetting, error) {
			return upserted, nil
		},
	}

	svc := NewSiteSettingsService(repo, nil)

	input := []*models.SiteSetting{
		{Key: "seo.title", Value: "Hello <script>alert('xss')</script>World"},
	}

	_, err := svc.UpdateSettings(context.Background(), 1, input)
	assert.NoError(t, err)
	assert.Equal(t, "Hello alert('xss')World", upserted[0].Value)
}

func TestSiteSettingsService_UpdateSettings_EmptyList(t *testing.T) {
	repo := &mockSiteSettingsRepo{}
	svc := NewSiteSettingsService(repo, nil)

	_, err := svc.UpdateSettings(context.Background(), 1, []*models.SiteSetting{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no settings provided")
}
