package auth

import (
	"context"
	"fmt"
	"log"
	"time"

	"google.golang.org/api/idtoken"

	"wealthjourney/domain/models"
	"wealthjourney/pkg/config"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/redis"
	authv1 "wealthjourney/protobuf/v1"

	jwt "github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

// UserService interface for user operations
type UserService interface {
	CreateUser(ctx context.Context, email, name, picture string) (*authv1.CreateUserResponse, error)
}

// CategoryService interface for category operations
type CategoryService interface {
	CreateDefaultCategories(ctx context.Context, userID int32) error
}

// Server provides authentication operations
type Server struct {
	db          *database.Database
	rdb         *redis.RedisClient
	cfg         *config.Config
	userSvc     UserService
	categorySvc CategoryService
}

// JWTClaims represents JWT token claims
type JWTClaims struct {
	UserID    int32  `json:"userId"`
	Email     string `json:"email"`
	SessionID string `json:"sessionId"` // Unique session identifier for multi-device support
	jwt.RegisteredClaims
}

// NewServer creates a new auth server with all dependencies.
func NewServer(db *database.Database, rdb *redis.RedisClient, cfg *config.Config, userSvc UserService, categorySvc CategoryService) *Server {
	return &Server{
		db:          db,
		rdb:         rdb,
		cfg:         cfg,
		userSvc:     userSvc,
		categorySvc: categorySvc,
	}
}

// UserData represents user information
type UserData struct {
	ID                   int32     `json:"id"`
	Email                string    `json:"email"`
	Name                 string    `json:"name"`
	Picture              string    `json:"picture"`
	PreferredCurrency    string    `json:"preferredCurrency"`
	ConversionInProgress bool      `json:"conversionInProgress"`
	CreatedAt            time.Time `json:"createdAt"`
	UpdatedAt            time.Time `json:"updatedAt"`
}

// userDataToProto converts UserData to proto User
func userDataToProto(data *UserData) *authv1.User {
	if data == nil {
		return nil
	}
	return &authv1.User{
		Id:                   data.ID,
		Email:                data.Email,
		Name:                 data.Name,
		Picture:              data.Picture,
		PreferredCurrency:    data.PreferredCurrency,
		ConversionInProgress: data.ConversionInProgress,
		CreatedAt:            data.CreatedAt.Unix(),
		UpdatedAt:            data.UpdatedAt.Unix(),
	}
}

// Register registers a new user using Google OAuth token
func (s *Server) Register(ctx context.Context, googleToken string) (*authv1.RegisterResponse, error) {
	return s.RegisterWithDevice(ctx, googleToken, &redis.SessionData{
		DeviceName: "Unknown Device",
		DeviceType: "unknown",
		IPAddress:  "unknown",
		UserAgent:  "unknown",
	})
}

// RegisterWithDevice registers with device information
func (s *Server) RegisterWithDevice(ctx context.Context, googleToken string, deviceInfo *redis.SessionData) (*authv1.RegisterResponse, error) {
	// Verify Google token
	payload, err := idtoken.Validate(ctx, googleToken, s.cfg.Google.ClientID)
	if err != nil {
		return nil, fmt.Errorf("invalid Google token: %w", err)
	}

	// Extract user info
	email := payload.Claims["email"].(string)
	name := payload.Claims["name"].(string)
	picture := payload.Claims["picture"].(string)

	var user models.User

	// Check if user exists
	result := s.db.DB.Where("email = ?", email).First(&user)
	if result.Error == nil {
		// User exists - login instead
		return s.generateLoginResponse(ctx, user, deviceInfo)
	} else if result.Error != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("database error: %w", result.Error)
	}

	// Create new user
	if s.userSvc != nil {
		_, err := s.userSvc.CreateUser(ctx, email, name, picture)
		if err != nil {
			return nil, fmt.Errorf("failed to create user via UserService: %w", err)
		}

		if err := s.db.DB.Where("email = ?", email).First(&user).Error; err != nil {
			return nil, fmt.Errorf("failed to retrieve created user: %w", err)
		}
	} else {
		user = models.User{
			Email:   email,
			Name:    name,
			Picture: picture,
		}

		if err := s.db.DB.Create(&user).Error; err != nil {
			return nil, fmt.Errorf("failed to create user: %w", err)
		}

		if s.categorySvc != nil {
			if err := s.categorySvc.CreateDefaultCategories(ctx, user.ID); err != nil {
				log.Printf("Warning: Failed to create default categories for user %d (%s): %v", user.ID, email, err)
			}
		}
	}

	return s.generateLoginResponse(ctx, user, deviceInfo)
}

// generateLoginResponse generates JWT token with session support
func (s *Server) generateLoginResponse(ctx context.Context, user models.User, deviceInfo *redis.SessionData) (*authv1.RegisterResponse, error) {
	// Generate unique session ID
	sessionID := models.GenerateSessionID()

	// Generate JWT token with session ID
	claims := JWTClaims{
		UserID:    user.ID,
		Email:     user.Email,
		SessionID: sessionID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.cfg.JWT.Expiration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.cfg.JWT.Secret))
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	// Prepare session metadata
	now := time.Now()
	sessionData := &redis.SessionData{
		SessionID:    sessionID,
		DeviceName:   deviceInfo.DeviceName,
		DeviceType:   deviceInfo.DeviceType,
		IPAddress:    deviceInfo.IPAddress,
		UserAgent:    deviceInfo.UserAgent,
		CreatedAt:    now,
		LastActiveAt: now,
		ExpiresAt:    now.Add(s.cfg.JWT.Expiration),
	}

	// Store session in Redis
	if err := s.rdb.AddSession(user.Email, sessionID, tokenString, sessionData); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	// Also save session to database for long-term tracking
	dbSession := &models.Session{
		SessionID:    sessionID,
		UserID:       user.ID,
		Token:        tokenString,
		DeviceName:   deviceInfo.DeviceName,
		DeviceType:   deviceInfo.DeviceType,
		IpAddress:    deviceInfo.IPAddress,
		UserAgent:    deviceInfo.UserAgent,
		LastActiveAt: now,
		ExpiresAt:    now.Add(s.cfg.JWT.Expiration),
	}

	if err := s.db.DB.Create(dbSession).Error; err != nil {
		// Log error but don't fail the login (Redis is source of truth)
		log.Printf("Warning: Failed to save session to database: %v", err)
	}

	return &authv1.RegisterResponse{
		Success: true,
		Message: "User registered successfully",
		Data: &authv1.LoginData{
			AccessToken: tokenString,
			Email:       user.Email,
			Fullname:    user.Name,
			Picture:     user.Picture,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

//nolint:unused
// extractDeviceInfo extracts device information from context (from request headers)
func extractDeviceInfo(ctx context.Context) *redis.SessionData {
	// This is a placeholder - in real implementation, extract from HTTP headers
	// For now, return empty device info
	return &redis.SessionData{
		DeviceName: "Unknown Device",
		DeviceType: "unknown",
		IPAddress:  "0.0.0.0",
		UserAgent:  "Unknown",
	}
}

// Login logs in a user using Google OAuth token
func (s *Server) Login(ctx context.Context, googleToken string) (*authv1.LoginResponse, error) {
	return s.LoginWithDeviceInfo(ctx, googleToken, &redis.SessionData{
		DeviceName: "Unknown Device",
		DeviceType: "unknown",
		IPAddress:  "unknown",
		UserAgent:  "unknown",
	})
}

// LoginWithDeviceInfo logs in with device information
func (s *Server) LoginWithDeviceInfo(ctx context.Context, googleToken string, deviceInfo *redis.SessionData) (*authv1.LoginResponse, error) {
	// Verify Google token
	payload, err := idtoken.Validate(ctx, googleToken, s.cfg.Google.ClientID)
	if err != nil {
		return nil, fmt.Errorf("invalid Google token: %w", err)
	}

	email := payload.Claims["email"].(string)

	// Find user
	var user models.User
	result := s.db.DB.Where("email = ?", email).First(&user)
	if result.Error == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found. Please register first")
	} else if result.Error != nil {
		return nil, fmt.Errorf("database error: %w", result.Error)
	}

	// Generate response with device info
	resp, err := s.generateLoginResponse(ctx, user, deviceInfo)
	if err != nil {
		return nil, err
	}

	// Convert RegisterResponse to LoginResponse
	return &authv1.LoginResponse{
		Success:   resp.Success,
		Message:   "Login successful",
		Data:      resp.Data,
		Timestamp: resp.Timestamp,
	}, nil
}

// Logout logs out a user and invalidates the token
func (s *Server) Logout(tokenString string) (*authv1.LogoutResponse, error) {
	// Parse token to get email and session ID
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWT.Secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Remove specific session from Redis
	if err := s.rdb.RemoveSession(claims.Email, claims.SessionID); err != nil {
		return nil, fmt.Errorf("failed to logout: %w", err)
	}

	// Mark session as deleted in database (soft delete)
	if err := s.db.DB.Where("session_id = ?", claims.SessionID).Delete(&models.Session{}).Error; err != nil {
		log.Printf("Warning: Failed to delete session from database: %v", err)
	}

	return &authv1.LogoutResponse{
		Success:   true,
		Message:   "Logged out successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// VerifyAuth verifies the authentication status
func (s *Server) VerifyAuth(tokenString string) (*authv1.VerifyAuthResponse, error) {
	// Parse token
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWT.Secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Verify session exists in Redis
	exists, err := s.rdb.SessionExists(claims.Email, claims.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to verify session: %w", err)
	}
	if !exists {
		return nil, fmt.Errorf("session not found or expired")
	}

	// Verify token matches the one stored for this session
	storedToken, err := s.rdb.GetSessionToken(claims.SessionID)
	if err != nil || storedToken != tokenString {
		return nil, fmt.Errorf("token mismatch for session")
	}

	// Update last active time
	if err := s.rdb.UpdateSessionActivity(claims.SessionID); err != nil {
		log.Printf("Warning: Failed to update session activity: %v", err)
	}

	// Get user from database
	var user models.User
	result := s.db.DB.Where("email = ?", claims.Email).First(&user)
	if result.Error != nil {
		return nil, fmt.Errorf("user not found")
	}

	userData := &UserData{
		ID:                   user.ID,
		Email:                user.Email,
		Name:                 user.Name,
		Picture:              user.Picture,
		PreferredCurrency:    user.PreferredCurrency,
		ConversionInProgress: user.ConversionInProgress,
		CreatedAt:            user.CreatedAt,
		UpdatedAt:            user.UpdatedAt,
	}

	return &authv1.VerifyAuthResponse{
		Success:   true,
		Message:   "User retrieved successfully",
		Data:      userDataToProto(userData),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ParseToken parses a JWT token and returns the claims
func (s *Server) ParseToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWT.Secret), nil
	})
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// GetAuth retrieves user information by email
func (s *Server) GetAuth(ctx context.Context, email string) (*authv1.GetAuthResponse, error) {
	// Get user from database
	var user models.User
	result := s.db.DB.Where("email = ?", email).First(&user)
	if result.Error == gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("user not found")
	} else if result.Error != nil {
		return nil, fmt.Errorf("database error: %w", result.Error)
	}

	return &authv1.GetAuthResponse{
		Success:   true,
		Message:   "User retrieved successfully",
		Data: userDataToProto(&UserData{
			ID:                   user.ID,
			Email:                user.Email,
			Name:                 user.Name,
			Picture:              user.Picture,
			PreferredCurrency:    user.PreferredCurrency,
			ConversionInProgress: user.ConversionInProgress,
			CreatedAt:            user.CreatedAt,
			UpdatedAt:            user.UpdatedAt,
		}),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// LoginWithDevice is a helper for testing multi-device login
// In production, device info is extracted from HTTP headers
func (s *Server) LoginWithDevice(ctx context.Context, email string, deviceInfo *redis.SessionData) (string, string, error) {
	var user models.User
	if err := s.db.DB.Where("email = ?", email).First(&user).Error; err != nil {
		return "", "", fmt.Errorf("user not found: %w", err)
	}

	resp, err := s.generateLoginResponse(ctx, user, deviceInfo)
	if err != nil {
		return "", "", err
	}

	// Parse token to get session ID
	token, _ := jwt.ParseWithClaims(resp.Data.AccessToken, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return []byte(s.cfg.JWT.Secret), nil
	})
	claims := token.Claims.(*JWTClaims)

	return resp.Data.AccessToken, claims.SessionID, nil
}
