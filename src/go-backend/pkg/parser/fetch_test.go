package parser

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestFetchFileContent_URL(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("test file content"))
	}))
	defer mockServer.Close()

	data, err := FetchFileContent(context.Background(), mockServer.URL)
	if err != nil {
		t.Fatalf("FetchFileContent failed: %v", err)
	}

	if string(data) != "test file content" {
		t.Errorf("Expected 'test file content', got %s", string(data))
	}
}

func TestFetchFileContent_LocalPath(t *testing.T) {
	// Create temporary file
	tmpFile := "/tmp/test-fetch.txt"
	_ = os.WriteFile(tmpFile, []byte("local file"), 0644)
	defer func() { _ = os.Remove(tmpFile) }()

	data, err := FetchFileContent(context.Background(), tmpFile)
	if err != nil {
		t.Fatalf("FetchFileContent failed: %v", err)
	}

	if string(data) != "local file" {
		t.Errorf("Expected 'local file', got %s", string(data))
	}
}

func TestFetchFileContent_HTTPError(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer mockServer.Close()

	_, err := FetchFileContent(context.Background(), mockServer.URL)
	if err == nil {
		t.Error("Expected error for 404 response, got none")
	}
}

func TestFetchFileContent_NonExistentFile(t *testing.T) {
	_, err := FetchFileContent(context.Background(), "/tmp/non-existent-file-12345.txt")
	if err == nil {
		t.Error("Expected error for non-existent file, got none")
	}
}

func TestFetchFileReader_URL(t *testing.T) {
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("test reader content"))
	}))
	defer mockServer.Close()

	reader, err := FetchFileReader(context.Background(), mockServer.URL)
	if err != nil {
		t.Fatalf("FetchFileReader failed: %v", err)
	}
	defer func() { _ = reader.Close() }()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read from reader: %v", err)
	}

	if string(data) != "test reader content" {
		t.Errorf("Expected 'test reader content', got %s", string(data))
	}
}

func TestFetchFileReader_LocalPath(t *testing.T) {
	// Create temporary file
	tmpFile := "/tmp/test-fetch-reader.txt"
	_ = os.WriteFile(tmpFile, []byte("local reader"), 0644)
	defer func() { _ = os.Remove(tmpFile) }()

	reader, err := FetchFileReader(context.Background(), tmpFile)
	if err != nil {
		t.Fatalf("FetchFileReader failed: %v", err)
	}
	defer func() { _ = reader.Close() }()

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read from reader: %v", err)
	}

	if string(data) != "local reader" {
		t.Errorf("Expected 'local reader', got %s", string(data))
	}
}

func TestOpenCSVReader_URL(t *testing.T) {
	csvContent := "Date,Amount,Description\n2024-01-01,100,Test\n2024-01-02,200,Test2"
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(csvContent))
	}))
	defer mockServer.Close()

	csvReader, closer, err := OpenCSVReader(context.Background(), mockServer.URL)
	if err != nil {
		t.Fatalf("OpenCSVReader failed: %v", err)
	}
	defer func() { _ = closer.Close() }()

	records, err := csvReader.ReadAll()
	if err != nil {
		t.Fatalf("Failed to read CSV: %v", err)
	}

	if len(records) != 3 {
		t.Errorf("Expected 3 records, got %d", len(records))
	}

	if records[0][0] != "Date" {
		t.Errorf("Expected 'Date' in first column, got %s", records[0][0])
	}
}

func TestOpenCSVReader_LocalPath(t *testing.T) {
	csvContent := "Date,Amount,Description\n2024-01-01,100,Test"
	tmpFile := "/tmp/test-csv-reader.csv"
	_ = os.WriteFile(tmpFile, []byte(csvContent), 0644)
	defer func() { _ = os.Remove(tmpFile) }()

	csvReader, closer, err := OpenCSVReader(context.Background(), tmpFile)
	if err != nil {
		t.Fatalf("OpenCSVReader failed: %v", err)
	}
	defer func() { _ = closer.Close() }()

	records, err := csvReader.ReadAll()
	if err != nil {
		t.Fatalf("Failed to read CSV: %v", err)
	}

	if len(records) != 2 {
		t.Errorf("Expected 2 records, got %d", len(records))
	}
}

func TestFetchFileReaderWithSize_URL(t *testing.T) {
	content := "test content for size check"
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(content))
	}))
	defer mockServer.Close()

	reader, err := FetchFileReaderWithSize(context.Background(), mockServer.URL)
	if err != nil {
		t.Fatalf("FetchFileReaderWithSize failed: %v", err)
	}
	defer func() { _ = reader.Close() }()

	if reader.Size() != int64(len(content)) {
		t.Errorf("Expected size %d, got %d", len(content), reader.Size())
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read from reader: %v", err)
	}

	if string(data) != content {
		t.Errorf("Expected '%s', got '%s'", content, string(data))
	}
}

func TestFetchFileReaderWithSize_LocalPath(t *testing.T) {
	content := "local file with size"
	tmpFile := "/tmp/test-size-reader.txt"
	_ = os.WriteFile(tmpFile, []byte(content), 0644)
	defer func() { _ = os.Remove(tmpFile) }()

	reader, err := FetchFileReaderWithSize(context.Background(), tmpFile)
	if err != nil {
		t.Fatalf("FetchFileReaderWithSize failed: %v", err)
	}
	defer func() { _ = reader.Close() }()

	if reader.Size() != int64(len(content)) {
		t.Errorf("Expected size %d, got %d", len(content), reader.Size())
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("Failed to read from reader: %v", err)
	}

	if string(data) != content {
		t.Errorf("Expected '%s', got '%s'", content, string(data))
	}
}
