package repository

import (
	"context"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/database"
)

type commentRepository struct {
	*BaseRepository
}

// NewCommentRepository creates a new comment repository
func NewCommentRepository(db *database.Database) CommentRepository {
	return &commentRepository{
		BaseRepository: NewBaseRepository(db),
	}
}

func (r *commentRepository) Create(ctx context.Context, comment *models.Comment) error {
	return r.executeCreate(ctx, comment, "comment")
}

func (r *commentRepository) GetByID(ctx context.Context, id int32) (*models.Comment, error) {
	var comment models.Comment
	err := r.db.DB.WithContext(ctx).Preload("User").First(&comment, id).Error
	if err != nil {
		return nil, r.handleDBError(err, "comment", "get comment")
	}
	return &comment, nil
}

func (r *commentRepository) Update(ctx context.Context, comment *models.Comment) error {
	return r.db.DB.WithContext(ctx).Save(comment).Error
}

func (r *commentRepository) SoftDelete(ctx context.Context, id int32) error {
	return r.executeDelete(ctx, &models.Comment{}, id, "comment")
}

func (r *commentRepository) GetByPostID(ctx context.Context, postID int32, opts ListOptions) ([]*models.Comment, int, error) {
	var comments []*models.Comment
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.Comment{}).
		Where("post_id = ?", postID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "comment", "count comments")
	}

	query = r.db.DB.WithContext(ctx).
		Where("post_id = ?", postID).
		Preload("User").
		Order("created_at ASC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&comments).Error; err != nil {
		return nil, 0, r.handleDBError(err, "comment", "get comments")
	}

	return comments, int(total), nil
}
