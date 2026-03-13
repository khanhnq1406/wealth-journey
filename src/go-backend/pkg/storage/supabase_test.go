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
	// Mock Supabase API server — handles both the upload POST and the sign POST
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}

		// Sign request: POST /storage/v1/object/sign/{bucket}/{key}
		if strings.Contains(r.URL.Path, "/storage/v1/object/sign/") {
			w.WriteHeader(http.StatusOK)
			_, err := w.Write([]byte(`{"signedURL": "/object/sign/test-bucket/uploads/test.csv?token=abc"}`))
			if err != nil {
				t.Errorf("Failed to write sign response: %v", err)
			}
			return
		}

		// Upload request: POST /storage/v1/object/{bucket}/{key}
		if !strings.Contains(r.URL.Path, "/storage/v1/object/test-bucket/") {
			t.Errorf("Expected path to contain bucket name, got %s", r.URL.Path)
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer test-api-key" {
			t.Errorf("Expected Bearer token, got %s", authHeader)
		}

		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(`{"Key": "uploads/test.csv"}`))
		if err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer mockServer.Close()

	storage := NewSupabaseStorage(mockServer.URL, "test-api-key", "test-bucket")

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

	// URL should be a signed URL, not a public URL
	if !strings.Contains(result.URL, "/object/sign/") {
		t.Errorf("Expected signed URL, got %s", result.URL)
	}
}

func TestSupabaseStorage_Delete(t *testing.T) {
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
	// Mock server returns a signed URL response
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if !strings.Contains(r.URL.Path, "/storage/v1/object/sign/test-bucket/uploads/test.csv") {
			t.Errorf("Unexpected sign path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(`{"signedURL": "/object/sign/test-bucket/uploads/test.csv?token=signed-token"}`))
		if err != nil {
			t.Errorf("Failed to write response: %v", err)
		}
	}))
	defer mockServer.Close()

	storage := NewSupabaseStorage(mockServer.URL, "test-api-key", "test-bucket")

	url, err := storage.GetURL(context.Background(), "uploads/test.csv")
	if err != nil {
		t.Fatalf("GetURL failed: %v", err)
	}

	expectedURL := mockServer.URL + "/storage/v1/object/sign/test-bucket/uploads/test.csv?token=signed-token"
	if url != expectedURL {
		t.Errorf("Expected URL %s, got %s", expectedURL, url)
	}
}
