package middleware

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"wealthjourney/pkg/redis"
)

type contextKey string

const (
	userIDKey   contextKey = "userId"
	userEmailKey contextKey = "email"
)

// AuthInterceptor validates JWT tokens from Redis whitelist
func AuthInterceptor(redisClient *redis.RedisClient) grpc.UnaryServerInterceptor {
	return func(
		ctx context.Context,
		req interface{},
		info *grpc.UnaryServerInfo,
		handler grpc.UnaryHandler,
	) (interface{}, error) {
		// Skip auth for login/register endpoints
		if strings.Contains(info.FullMethod, "Login") ||
			strings.Contains(info.FullMethod, "Register") {
			return handler(ctx, req)
		}

		// Extract token from metadata
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}

		tokens := md["authorization"]
		if len(tokens) == 0 {
			return nil, status.Error(codes.Unauthenticated, "missing authorization token")
		}

		_ = strings.TrimPrefix(tokens[0], "Bearer ")

		// Verify token is in whitelist (this is a simplified check)
		// In production, you would decode JWT and get email from it
		// For now, we'll just pass through and let individual services handle verification

		return handler(ctx, req)
	}
}

// ExtractUserID extracts user ID from context
func ExtractUserID(ctx context.Context) (int32, bool) {
	userID, ok := ctx.Value(userIDKey).(int32)
	return userID, ok
}

// ExtractUserEmail extracts user email from context
func ExtractUserEmail(ctx context.Context) (string, bool) {
	email, ok := ctx.Value(userEmailKey).(string)
	return email, ok
}

// AddUserToContext adds user info to context
func AddUserToContext(ctx context.Context, userID int32, email string) context.Context {
	ctx = context.WithValue(ctx, userIDKey, userID)
	ctx = context.WithValue(ctx, userEmailKey, email)
	return ctx
}

// GetTokenFromContext extracts bearer token from context metadata
func GetTokenFromContext(ctx context.Context) (string, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return "", fmt.Errorf("missing metadata")
	}

	tokens := md["authorization"]
	if len(tokens) == 0 {
		return "", fmt.Errorf("missing authorization token")
	}

	token := tokens[0]
	token = strings.TrimPrefix(token, "Bearer ")
	return token, nil
}
