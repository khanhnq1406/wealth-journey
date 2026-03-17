package grpcserver

import (
	"context"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"wealthjourney/domain/auth"
	protobufv1 "wealthjourney/protobuf/v1"
)

// grpcAuthServer implements the AuthService gRPC interface
type grpcAuthServer struct {
	protobufv1.UnimplementedAuthServiceServer
	server *auth.Server
}

// NewAuthServer creates a new AuthService gRPC server
func NewAuthServer(server *auth.Server) protobufv1.AuthServiceServer {
	return &grpcAuthServer{
		server: server,
	}
}

// Register registers a new user using Google OAuth token
func (s *grpcAuthServer) Register(ctx context.Context, req *protobufv1.RegisterRequest) (*protobufv1.RegisterResponse, error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}

	return s.server.Register(ctx, req.Token)
}

// Login logs in a user using Google OAuth token
func (s *grpcAuthServer) Login(ctx context.Context, req *protobufv1.LoginRequest) (*protobufv1.LoginResponse, error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}

	return s.server.Login(ctx, req.Token)
}

// Logout logs out a user and invalidates the token
func (s *grpcAuthServer) Logout(ctx context.Context, req *protobufv1.LogoutRequest) (*protobufv1.LogoutResponse, error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}

	return s.server.Logout(req.Token)
}

// VerifyAuth verifies the authentication status
func (s *grpcAuthServer) VerifyAuth(ctx context.Context, req *protobufv1.VerifyAuthRequest) (*protobufv1.VerifyAuthResponse, error) {
	if req.Token == "" {
		return nil, status.Error(codes.InvalidArgument, "token is required")
	}

	result, err := s.server.VerifyAuth(req.Token)
	if err != nil {
		return nil, status.Error(codes.Unauthenticated, err.Error())
	}

	return result, nil
}

// GetAuth retrieves user information
// NOTE: This gRPC endpoint is deprecated in favor of the REST handler which uses userID from JWT.
// Kept for gRPC-Gateway compatibility. The email field in the request is no longer used;
// authentication is handled via JWT middleware which provides userID.
func (s *grpcAuthServer) GetAuth(ctx context.Context, req *protobufv1.GetAuthRequest) (*protobufv1.GetAuthResponse, error) {
	// In gRPC-Gateway flow, auth middleware sets user_id in context.
	// For direct gRPC calls, the token must be provided and parsed.
	// Since this endpoint requires authentication, userID should be available from middleware.
	// Fallback: return an error indicating this flow requires the REST endpoint.
	return nil, status.Error(codes.Unimplemented, "use REST /api/v1/auth endpoint instead")
}
