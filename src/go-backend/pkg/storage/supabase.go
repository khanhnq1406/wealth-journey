package storage

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
)

// Compile-time check to ensure SupabaseStorage implements StorageProvider.
var _ StorageProvider = (*SupabaseStorage)(nil)

// SupabaseStorage implements StorageProvider for Supabase Storage.
type SupabaseStorage struct {
	baseURL  string // e.g., "https://xxx.supabase.co"
	apiKey   string // Service role key or anon key
	bucket   string // Bucket name
	client   *http.Client
	isPublic bool // true = public bucket (permanent URLs), false = private bucket (signed URLs)
}

// NewSupabaseStorage creates a Supabase storage provider for a private bucket.
// GetURL generates a signed URL with 24-hour expiry.
func NewSupabaseStorage(baseURL, apiKey, bucket string) *SupabaseStorage {
	return &SupabaseStorage{
		baseURL:  baseURL,
		apiKey:   apiKey,
		bucket:   bucket,
		client:   &http.Client{},
		isPublic: false,
	}
}

// NewSupabasePublicStorage creates a Supabase storage provider for a public bucket.
// GetURL returns a permanent public URL — no signing, no expiry.
func NewSupabasePublicStorage(baseURL, apiKey, bucket string) *SupabaseStorage {
	return &SupabaseStorage{
		baseURL:  baseURL,
		apiKey:   apiKey,
		bucket:   bucket,
		client:   &http.Client{},
		isPublic: true,
	}
}

// Upload uploads a file to Supabase Storage.
func (s *SupabaseStorage) Upload(ctx context.Context, file io.Reader, key string, contentType string) (*UploadResult, error) {
	// Read file content to get size
	fileContent, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}
	fileSize := int64(len(fileContent))

	// Build upload URL
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, s.bucket, key)

	// Create request
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, uploadURL, bytes.NewReader(fileContent))
	if err != nil {
		return nil, fmt.Errorf("failed to create upload request: %w", err)
	}

	// Set headers
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", contentType)

	// Execute request
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Generate signed URL for private bucket access
	signedURL, err := s.GetURL(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to generate signed URL: %w", err)
	}

	return &UploadResult{
		URL:      signedURL,
		Key:      key,
		Size:     fileSize,
		MimeType: contentType,
	}, nil
}

// Delete removes a file from Supabase Storage.
func (s *SupabaseStorage) Delete(ctx context.Context, key string) error {
	deleteURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", s.baseURL, s.bucket, key)

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, deleteURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create delete request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	// 404 is acceptable (file already deleted or never existed)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetURL returns a URL for accessing a file in the bucket.
// Public buckets return a permanent URL; private buckets return a signed URL expiring in 24 hours.
func (s *SupabaseStorage) GetURL(ctx context.Context, key string) (string, error) {
	if s.isPublic {
		return fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.baseURL, s.bucket, key), nil
	}
	return s.signURL(ctx, key)
}

// signURL calls the Supabase sign endpoint to generate a 24-hour temporary URL.
func (s *SupabaseStorage) signURL(ctx context.Context, key string) (string, error) {
	signURL := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", s.baseURL, s.bucket, key)

	reqBody := bytes.NewBufferString(`{"expiresIn": 86400}`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, signURL, reqBody)
	if err != nil {
		return "", fmt.Errorf("failed to create sign request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to generate signed URL: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read sign response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("sign request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("failed to parse sign response: %w", err)
	}

	// Supabase returns a relative path like "/object/sign/..." — prepend base + "/storage/v1"
	return fmt.Sprintf("%s/storage/v1%s", s.baseURL, result.SignedURL), nil
}

// GetMimeType returns MIME type based on file extension.
func GetMimeType(filename string) string {
	ext := path.Ext(filename)
	switch ext {
	case ".csv":
		return "text/csv"
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	case ".xls":
		return "application/vnd.ms-excel"
	case ".pdf":
		return "application/pdf"
	default:
		return "application/octet-stream"
	}
}
