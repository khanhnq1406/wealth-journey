package service

import (
	"context"
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	apperrors "wealthjourney/pkg/errors"
	v1 "wealthjourney/protobuf/v1"
)

const (
	goldSentimentCachePrefix = "gold_sentiment:"
	goldSentimentCacheTTL    = 30 * time.Second
	maxCommentsPerDay        = 5
	maxCommentLength         = 500
)

var uuidRegex = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type goldSentimentService struct {
	voteRepo    repository.GoldVoteRepository
	commentRepo repository.GoldVoteCommentRepository
	userRepo    repository.UserRepository
	redis       *redis.Client
}

func NewGoldSentimentService(
	voteRepo repository.GoldVoteRepository,
	commentRepo repository.GoldVoteCommentRepository,
	userRepo repository.UserRepository,
	redisClient *redis.Client,
) GoldSentimentService {
	return &goldSentimentService{
		voteRepo:    voteRepo,
		commentRepo: commentRepo,
		userRepo:    userRepo,
		redis:       redisClient,
	}
}

// getTodayVietnam returns today's date in Vietnam timezone (UTC+7), truncated to midnight.
func getTodayVietnam() time.Time {
	loc := time.FixedZone("UTC+7", 7*60*60)
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
}

func (s *goldSentimentService) GetSentiment(ctx context.Context, userID int32, anonymousID string) (*v1.GetGoldSentimentResponse, error) {
	today := getTodayVietnam()

	// Try cache first
	resp, err := s.getCachedSentiment(ctx, today)
	if err == nil && resp != nil {
		s.populateUserVote(ctx, resp, userID, anonymousID, today)
		return resp, nil
	}

	// Cache miss — query DB
	bullish, bearish, err := s.voteRepo.CountByDate(ctx, today)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get vote counts", err)
	}

	total := bullish + bearish
	bullishPct, bearishPct := computePercentages(bullish, bearish, total)

	resp = &v1.GetGoldSentimentResponse{
		BullishCount:      bullish,
		BearishCount:      bearish,
		TotalVotes:        total,
		BullishPercentage: bullishPct,
		BearishPercentage: bearishPct,
		VoteDate:          today.Format("2006-01-02"),
	}

	// Cache the result
	_ = s.cacheSentiment(ctx, today, resp)

	s.populateUserVote(ctx, resp, userID, anonymousID, today)

	return resp, nil
}

// populateUserVote sets the userVote field based on auth or anonymous ID.
func (s *goldSentimentService) populateUserVote(ctx context.Context, resp *v1.GetGoldSentimentResponse, userID int32, anonymousID string, today time.Time) {
	if userID > 0 {
		vote, err := s.voteRepo.GetByUserAndDate(ctx, userID, today)
		if err == nil && vote != nil {
			resp.UserVote = v1.VoteDirection(vote.Direction)
		}
	} else if anonymousID != "" {
		vote, err := s.voteRepo.GetByAnonymousIDAndDate(ctx, anonymousID, today)
		if err == nil && vote != nil {
			resp.UserVote = v1.VoteDirection(vote.Direction)
		}
	}
}

func (s *goldSentimentService) CastVote(ctx context.Context, userID int32, anonymousID string, req *v1.CastGoldVoteRequest) (*v1.CastGoldVoteResponse, error) {
	// Validate direction
	if req.Direction != v1.VoteDirection_VOTE_DIRECTION_BULLISH && req.Direction != v1.VoteDirection_VOTE_DIRECTION_BEARISH {
		return nil, apperrors.NewValidationError("direction must be BULLISH (1) or BEARISH (2)")
	}

	today := getTodayVietnam()
	var responseAnonymousID string

	if userID > 0 {
		// Authenticated user vote
		// If anonymous ID provided, delete the anonymous vote to prevent double-counting
		if anonymousID != "" && isValidUUID(anonymousID) {
			_ = s.voteRepo.DeleteByAnonymousIDAndDate(ctx, anonymousID, today)
		}

		vote := &models.GoldVote{
			UserID:    &userID,
			VoteDate:  today,
			Direction: int32(req.Direction),
		}
		if err := s.voteRepo.Upsert(ctx, vote); err != nil {
			return nil, err
		}
	} else {
		// Anonymous vote
		if anonymousID == "" || !isValidUUID(anonymousID) {
			anonymousID = uuid.New().String()
		}

		vote := &models.GoldVote{
			AnonymousID: &anonymousID,
			VoteDate:    today,
			Direction:   int32(req.Direction),
		}
		if err := s.voteRepo.UpsertAnonymous(ctx, vote); err != nil {
			return nil, err
		}
		responseAnonymousID = anonymousID
	}

	// Invalidate cache
	s.invalidateCache(ctx, today)

	// Get updated counts
	bullish, bearish, err := s.voteRepo.CountByDate(ctx, today)
	if err != nil {
		return nil, apperrors.NewInternalErrorWithCause("failed to get updated counts", err)
	}

	total := bullish + bearish
	bullishPct, bearishPct := computePercentages(bullish, bearish, total)

	return &v1.CastGoldVoteResponse{
		Direction:         req.Direction,
		BullishCount:      bullish,
		BearishCount:      bearish,
		TotalVotes:        total,
		BullishPercentage: bullishPct,
		BearishPercentage: bearishPct,
		AnonymousId:       responseAnonymousID,
	}, nil
}

// isValidUUID checks if the string is a valid UUID format.
func isValidUUID(s string) bool {
	return len(s) == 36 && uuidRegex.MatchString(s)
}

const maxCommentFallbackDays = 7

func (s *goldSentimentService) GetComments(ctx context.Context, userID int32, req *v1.GetGoldSentimentCommentsRequest) (*v1.GetGoldSentimentCommentsResponse, error) {
	today := getTodayVietnam()

	page := int(req.Page)
	pageSize := int(req.PageSize)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	// Try today first; if empty (page 1 only), fall back to recent days
	commentDate := today
	comments, total, err := s.commentRepo.ListByDate(ctx, commentDate, pageSize, offset)
	if err != nil {
		return nil, err
	}

	if total == 0 && page == 1 {
		for i := 1; i <= maxCommentFallbackDays; i++ {
			prevDay := today.AddDate(0, 0, -i)
			comments, total, err = s.commentRepo.ListByDate(ctx, prevDay, pageSize, offset)
			if err != nil {
				return nil, err
			}
			if total > 0 {
				commentDate = prevDay
				break
			}
		}
	}

	// Get user vote directions for comment authors
	var items []*v1.GoldSentimentCommentItem
	for _, c := range comments {
		item := &v1.GoldSentimentCommentItem{
			Id:           c.ID,
			UserId:       c.UserID,
			Content:      c.Content,
			CreatedAt:    c.CreatedAt.Unix(),
			IsOwnComment: userID > 0 && c.UserID == userID,
		}

		if c.User != nil {
			item.UserName = c.User.Name
			item.UserPicture = c.User.Picture
		}

		// Get author's vote direction for that day
		vote, err := s.voteRepo.GetByUserAndDate(ctx, c.UserID, commentDate)
		if err == nil && vote != nil {
			item.UserVoteDirection = v1.VoteDirection(vote.Direction)
		}

		items = append(items, item)
	}

	return &v1.GetGoldSentimentCommentsResponse{
		Comments:    items,
		TotalCount:  int32(total),
		Page:        int32(page),
		PageSize:    int32(pageSize),
		CommentDate: commentDate.Format("2006-01-02"),
	}, nil
}

func (s *goldSentimentService) PostComment(ctx context.Context, userID int32, req *v1.PostGoldSentimentCommentRequest) (*v1.PostGoldSentimentCommentResponse, error) {
	// Validate content
	content := strings.TrimSpace(req.Content)
	if len(content) == 0 {
		return nil, apperrors.NewValidationError("comment content is required")
	}
	if len(content) > maxCommentLength {
		return nil, apperrors.NewValidationError(fmt.Sprintf("comment content must be at most %d characters", maxCommentLength))
	}

	// HTML-escape for XSS prevention
	content = html.EscapeString(content)

	today := getTodayVietnam()

	// Check daily limit
	count, err := s.commentRepo.CountByUserAndDate(ctx, userID, today)
	if err != nil {
		return nil, err
	}
	if count >= maxCommentsPerDay {
		return nil, apperrors.NewValidationError(fmt.Sprintf("maximum %d comments per day reached", maxCommentsPerDay))
	}

	comment := &models.GoldVoteComment{
		UserID:   userID,
		VoteDate: today,
		Content:  content,
	}

	if err := s.commentRepo.Create(ctx, comment); err != nil {
		return nil, err
	}

	// Load user for response
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Get user's vote direction for today
	var voteDirection v1.VoteDirection
	vote, err := s.voteRepo.GetByUserAndDate(ctx, userID, today)
	if err == nil && vote != nil {
		voteDirection = v1.VoteDirection(vote.Direction)
	}

	return &v1.PostGoldSentimentCommentResponse{
		Comment: &v1.GoldSentimentCommentItem{
			Id:                 comment.ID,
			UserId:             comment.UserID,
			UserName:           user.Name,
			UserPicture:        user.Picture,
			Content:            comment.Content,
			CreatedAt:          comment.CreatedAt.Unix(),
			IsOwnComment:       true,
			UserVoteDirection:  voteDirection,
		},
	}, nil
}

func (s *goldSentimentService) DeleteComment(ctx context.Context, userID int32, commentID int32) error {
	// Verify ownership
	comment, err := s.commentRepo.GetByID(ctx, commentID)
	if err != nil {
		return err
	}

	if comment.UserID != userID {
		return apperrors.NewForbiddenError("you can only delete your own comments")
	}

	return s.commentRepo.Delete(ctx, commentID)
}

// computePercentages calculates bullish and bearish percentages.
func computePercentages(bullish, bearish, total int32) (bullishPct, bearishPct float64) {
	if total == 0 {
		return 0, 0
	}
	bullishPct = float64(bullish) / float64(total) * 100
	bearishPct = float64(bearish) / float64(total) * 100
	return bullishPct, bearishPct
}

// Redis cache helpers

type cachedSentimentData struct {
	BullishCount      int32   `json:"bc"`
	BearishCount      int32   `json:"bec"`
	TotalVotes        int32   `json:"tv"`
	BullishPercentage float64 `json:"bp"`
	BearishPercentage float64 `json:"bep"`
	VoteDate          string  `json:"vd"`
}

func (s *goldSentimentService) getCachedSentiment(ctx context.Context, date time.Time) (*v1.GetGoldSentimentResponse, error) {
	if s.redis == nil {
		return nil, fmt.Errorf("no redis")
	}

	key := goldSentimentCachePrefix + date.Format("2006-01-02")
	data, err := s.redis.Get(ctx, key).Bytes()
	if err != nil {
		return nil, err
	}

	var cached cachedSentimentData
	if err := json.Unmarshal(data, &cached); err != nil {
		return nil, err
	}

	return &v1.GetGoldSentimentResponse{
		BullishCount:      cached.BullishCount,
		BearishCount:      cached.BearishCount,
		TotalVotes:        cached.TotalVotes,
		BullishPercentage: cached.BullishPercentage,
		BearishPercentage: cached.BearishPercentage,
		VoteDate:          cached.VoteDate,
	}, nil
}

func (s *goldSentimentService) cacheSentiment(ctx context.Context, date time.Time, resp *v1.GetGoldSentimentResponse) error {
	if s.redis == nil {
		return nil
	}

	cached := cachedSentimentData{
		BullishCount:      resp.BullishCount,
		BearishCount:      resp.BearishCount,
		TotalVotes:        resp.TotalVotes,
		BullishPercentage: resp.BullishPercentage,
		BearishPercentage: resp.BearishPercentage,
		VoteDate:          resp.VoteDate,
	}

	data, err := json.Marshal(cached)
	if err != nil {
		return err
	}

	key := goldSentimentCachePrefix + date.Format("2006-01-02")
	return s.redis.Set(ctx, key, data, goldSentimentCacheTTL).Err()
}

func (s *goldSentimentService) invalidateCache(ctx context.Context, date time.Time) {
	if s.redis == nil {
		return
	}
	key := goldSentimentCachePrefix + date.Format("2006-01-02")
	_ = s.redis.Del(ctx, key)
}
