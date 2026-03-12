package storage

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSupabaseStorage_Upload(t *testing.T) {
	// Mock Supabase API server
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify request method and path
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}

		if !strings.Contains(r.URL.Path, "/storage/v1/object/test-bucket/") {
			t.Errorf("Expected path to contain bucket name, got %s", r.URL.Path)
		}

		// Verify Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer test-api-key" {
			t.Errorf("Expected Bearer token, got %s", authHeader)
		}

		// Return success response
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(`{"Key": "uploads/test.csv"}`))
		if err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer mockServer.Close()

	// Create Supabase storage with mock server URL
	storage := NewSupabaseStorage(mockServer.URL, "test-api-key", "test-bucket")

	// Test upload
	fileContent := []byte("test,data\n1,2")
	result, err := storage.Upload(context.Background(), bytes.NewReader(fileContent), "uploads/test.csv", "text/csv")

	if err != nil {
		t.Fatalf("Upload failed: %v", err)
	}

	if result.Key != "uploads/test.csv" {
		t.Errorf("Expected key 'uploads/test.csv', got %s", result.Key)
	}

	if result.Size != int64(len(fileContent)) {
		t.Errorf("Expected size %d, got %d", len(fileContent), result.Size)
	}
}

func TestSupabaseStorage_Delete(t *testing.T) {
	// Mock server for delete
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("Expected DELETE request, got %s", r.Method)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer mockServer.Close()

	storage := NewSupabaseStorage(mockServer.URL, "test-api-key", "test-bucket")

	err := storage.Delete(context.Background(), "uploads/test.csv")
	if err != nil {
		t.Fatalf("Delete failed: %v", err)
	}
}

func TestSupabaseStorage_GetURL(t *testing.T) {
	storage := NewSupabaseStorage("https://test.supabase.co", "test-api-key", "test-bucket")

	url, err := storage.GetURL(context.Background(), "uploads/test.csv")
	if err != nil {
		t.Fatalf("GetURL failed: %v", err)
	}

	expectedURL := "https://test.supabase.co/storage/v1/object/public/test-bucket/uploads/test.csv"
	if url != expectedURL {
		t.Errorf("Expected URL %s, got %s", expectedURL, url)
	}
}
