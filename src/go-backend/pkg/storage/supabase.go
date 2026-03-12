package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"path"
)

// Compile-time check to ensure SupabaseStorage implements StorageProvider.
var _ StorageProvider = (*SupabaseStorage)(nil)

// SupabaseStorage implements StorageProvider for Supabase Storage.
type SupabaseStorage struct {
	baseURL string // e.g., "https://xxx.supabase.co"
	apiKey  string // Service role key or anon key
	bucket  string // Bucket name
	client  *http.Client
}

// NewSupabaseStorage creates a new Supabase storage provider.
func NewSupabaseStorage(baseURL, apiKey, bucket string) *SupabaseStorage {
	return &SupabaseStorage{
		baseURL: baseURL,
		apiKey:  apiKey,
		bucket:  bucket,
		client:  &http.Client{},
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
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Generate public URL
	publicURL, err := s.GetURL(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("failed to generate public URL: %w", err)
	}

	return &UploadResult{
		URL:      publicURL,
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
	defer resp.Body.Close()

	// 404 is acceptable (file already deleted or never existed)
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("delete failed with status %d: %s", resp.StatusCode, string(body))
	}

	return nil
}

// GetURL returns the public URL for accessing a file in the bucket.
func (s *SupabaseStorage) GetURL(_ context.Context, key string) (string, error) {
	return fmt.Sprintf("%s/storage/v1/object/public/%s/%s", s.baseURL, s.bucket, key), nil
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
