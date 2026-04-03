package config

import (
	"os"
	"testing"
)

func TestLoadConfig_CORS_MultipleOrigins(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
	_ = os.Setenv("CORS_ALLOWED_ORIGINS", "https://a.com,https://b.com")
	defer func() {
		_ = os.Unsetenv("JWT_SECRET")
		_ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	if len(cfg.CORS.AllowedOrigins) != 2 {
		t.Errorf("Expected 2 origins, got %d", len(cfg.CORS.AllowedOrigins))
	}
	if cfg.CORS.AllowedOrigins[0] != "https://a.com" {
		t.Errorf("Expected first origin 'https://a.com', got %s", cfg.CORS.AllowedOrigins[0])
	}
	if cfg.CORS.AllowedOrigins[1] != "https://b.com" {
		t.Errorf("Expected second origin 'https://b.com', got %s", cfg.CORS.AllowedOrigins[1])
	}
}

func TestLoadConfig_CORS_WhitespaceTrimmed(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
	_ = os.Setenv("CORS_ALLOWED_ORIGINS", "  https://a.com , https://b.com  ")
	defer func() {
		_ = os.Unsetenv("JWT_SECRET")
		_ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	if len(cfg.CORS.AllowedOrigins) != 2 {
		t.Errorf("Expected 2 origins after trimming, got %d", len(cfg.CORS.AllowedOrigins))
	}
	if cfg.CORS.AllowedOrigins[0] != "https://a.com" {
		t.Errorf("Expected trimmed origin 'https://a.com', got %s", cfg.CORS.AllowedOrigins[0])
	}
}

func TestLoadConfig_CORS_TrailingCommaDropped(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
	_ = os.Setenv("CORS_ALLOWED_ORIGINS", "https://a.com,")
	defer func() {
		_ = os.Unsetenv("JWT_SECRET")
		_ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	if len(cfg.CORS.AllowedOrigins) != 1 {
		t.Errorf("Expected 1 origin (trailing comma dropped), got %d", len(cfg.CORS.AllowedOrigins))
	}
}

func TestLoadConfig_CORS_DefaultLocalhost(t *testing.T) {
	_ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
	_ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
	defer func() {
		_ = os.Unsetenv("JWT_SECRET")
	}()

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}
	if len(cfg.CORS.AllowedOrigins) != 1 {
		t.Errorf("Expected 1 default origin, got %d", len(cfg.CORS.AllowedOrigins))
	}
	if cfg.CORS.AllowedOrigins[0] != "http://localhost:3000" {
		t.Errorf("Expected default 'http://localhost:3000', got %s", cfg.CORS.AllowedOrigins[0])
	}
}

func TestLoadConfig_SupabaseStorage(t *testing.T) {
	// Set environment variables for test
	_ = os.Setenv("JWT_SECRET", "test-secret-key-12345")
	_ = os.Setenv("SUPABASE_URL", "https://test.supabase.co")
	_ = os.Setenv("SUPABASE_API_KEY", "test-api-key")
	_ = os.Setenv("SUPABASE_BUCKET", "test-bucket")
	defer func() {
		_ = os.Unsetenv("JWT_SECRET")
		_ = os.Unsetenv("SUPABASE_URL")
		_ = os.Unsetenv("SUPABASE_API_KEY")
		_ = os.Unsetenv("SUPABASE_BUCKET")
	}()

	// This will fail until we add Storage config
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	if cfg.Storage.SupabaseURL != "https://test.supabase.co" {
		t.Errorf("Expected SupabaseURL to be 'https://test.supabase.co', got %s", cfg.Storage.SupabaseURL)
	}

	if cfg.Storage.SupabaseAPIKey != "test-api-key" {
		t.Errorf("Expected SupabaseAPIKey to be 'test-api-key', got %s", cfg.Storage.SupabaseAPIKey)
	}

	if cfg.Storage.SupabaseBucket != "test-bucket" {
		t.Errorf("Expected SupabaseBucket to be 'test-bucket', got %s", cfg.Storage.SupabaseBucket)
	}
}
