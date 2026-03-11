package repository

import (
	"context"

	"gorm.io/gorm"
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
		Where("post_id = ? AND parent_comment_id IS NULL", postID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "comment", "count comments")
	}

	query = r.db.DB.WithContext(ctx).
		Where("post_id = ? AND parent_comment_id IS NULL", postID).
		Preload("User").
		Order("created_at ASC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&comments).Error; err != nil {
		return nil, 0, r.handleDBError(err, "comment", "get comments")
	}

	return comments, int(total), nil
}

// GetByParentID returns replies for a parent comment (paginated, ordered by creation time ASC).
func (r *commentRepository) GetByParentID(ctx context.Context, parentID int32, opts ListOptions) ([]*models.Comment, int, error) {
	var comments []*models.Comment
	var total int64

	query := r.db.DB.WithContext(ctx).Model(&models.Comment{}).
		Where("parent_comment_id = ?", parentID)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, r.handleDBError(err, "comment", "count replies")
	}

	query = r.db.DB.WithContext(ctx).
		Where("parent_comment_id = ?", parentID).
		Preload("User").
		Order("created_at ASC")
	query = r.applyPagination(query, opts)

	if err := query.Find(&comments).Error; err != nil {
		return nil, 0, r.handleDBError(err, "comment", "get replies")
	}

	return comments, int(total), nil
}

// IncrementReplyCount atomically increments or decrements reply_count for a comment.
func (r *commentRepository) IncrementReplyCount(ctx context.Context, commentID int32, delta int32) error {
	if delta == 0 {
		return nil
	}
	return r.db.DB.WithContext(ctx).
		Model(&models.Comment{}).
		Where("id = ?", commentID).
		UpdateColumn("reply_count", gorm.Expr("reply_count + ?", delta)).
		Error
}
