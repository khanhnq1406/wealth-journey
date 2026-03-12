package parser

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// FetchFileContent retrieves file content from URL or local path.
// If the path starts with http:// or https://, it downloads the file.
// Otherwise, it reads from local filesystem.
func FetchFileContent(ctx context.Context, path string) ([]byte, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		return downloadFile(ctx, path)
	}

	// Local file path (backward compatibility)
	return os.ReadFile(path)
}

// FetchFileReader returns an io.ReadCloser for the file from URL or local path.
// Caller is responsible for closing the reader.
func FetchFileReader(ctx context.Context, path string) (io.ReadCloser, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		data, err := downloadFile(ctx, path)
		if err != nil {
			return nil, err
		}
		return io.NopCloser(bytes.NewReader(data)), nil
	}

	// Local file path (backward compatibility)
	return os.Open(path)
}

func downloadFile(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create download request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to download file: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read download response: %w", err)
	}

	return data, nil
}

// OpenCSVReader returns a CSV reader for the file from URL or local path.
func OpenCSVReader(ctx context.Context, path string) (*csv.Reader, io.Closer, error) {
	reader, err := FetchFileReader(ctx, path)
	if err != nil {
		return nil, nil, err
	}

	csvReader := csv.NewReader(reader)
	return csvReader, reader, nil
}

// FileReaderWithSize is an io.ReadSeeker that also knows its size
type FileReaderWithSize struct {
	*bytes.Reader
	size int64
}

// Size returns the size of the content
func (f *FileReaderWithSize) Size() int64 {
	return f.size
}

// Close implements io.Closer (no-op for in-memory reader)
func (f *FileReaderWithSize) Close() error {
	return nil
}

// FetchFileReaderWithSize returns a reader with size information for PDF parsing.
// For URLs, downloads the content and returns an in-memory reader.
// For local files, opens the file and returns a file handle.
func FetchFileReaderWithSize(ctx context.Context, path string) (*FileReaderWithSize, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		data, err := downloadFile(ctx, path)
		if err != nil {
			return nil, err
		}
		return &FileReaderWithSize{
			Reader: bytes.NewReader(data),
			size:   int64(len(data)),
		}, nil
	}

	// For local files, read into memory to provide consistent interface
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	return &FileReaderWithSize{
		Reader: bytes.NewReader(data),
		size:   int64(len(data)),
	}, nil
}
