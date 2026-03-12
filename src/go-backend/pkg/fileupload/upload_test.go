package fileupload

import (
	"bytes"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// mockFile implements the multipart.File interface for testing
type mockFile struct {
	*bytes.Reader
}

func (m *mockFile) Close() error {
	return nil
}

func newMockFile(content string) *mockFile {
	return &mockFile{
		Reader: bytes.NewReader([]byte(content)),
	}
}

func TestValidateFileType(t *testing.T) {
	tests := []struct {
		filename    string
		expected    FileType
		expectError bool
	}{
		{"statement.csv", FileTypeCSV, false},
		{"statement.xlsx", FileTypeExcel, false},
		{"statement.xls", FileTypeExcel, false},
		{"statement.pdf", FileTypePDF, false},
		{"statement.txt", "", true},
		{"statement.doc", "", true},
		{"statement", "", true},
		{"statement.CSV", FileTypeCSV, false}, // Case insensitive
		{"statement.XLSX", FileTypeExcel, false},
	}

	for _, tt := range tests {
		t.Run(tt.filename, func(t *testing.T) {
			fileType, err := ValidateFileType(tt.filename)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for %s, got none", tt.filename)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error for %s, got: %v", tt.filename, err)
				}
				if fileType != tt.expected {
					t.Errorf("Expected %s for %s, got %s", tt.expected, tt.filename, fileType)
				}
			}
		})
	}
}

func TestValidateFileSize(t *testing.T) {
	tests := []struct {
		name        string
		size        int64
		fileType    FileType
		expectError bool
	}{
		{"CSV valid size", 5 * 1024 * 1024, FileTypeCSV, false},
		{"CSV at max size", MaxCSVSize, FileTypeCSV, false},
		{"CSV too large", 11 * 1024 * 1024, FileTypeCSV, true},
		{"CSV empty", 0, FileTypeCSV, true},
		{"Excel valid size", 8 * 1024 * 1024, FileTypeExcel, false},
		{"Excel at max size", MaxExcelSize, FileTypeExcel, false},
		{"Excel too large", 11 * 1024 * 1024, FileTypeExcel, true},
		{"Excel empty", 0, FileTypeExcel, true},
		{"PDF valid size", 15 * 1024 * 1024, FileTypePDF, false},
		{"PDF at max size", MaxPDFSize, FileTypePDF, false},
		{"PDF too large", 21 * 1024 * 1024, FileTypePDF, true},
		{"PDF empty", 0, FileTypePDF, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateFileSize(tt.size, tt.fileType)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for %s, got none", tt.name)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error for %s, got: %v", tt.name, err)
				}
			}
		})
	}
}

func TestUploadFile(t *testing.T) {
	// Create test upload directory
	testUploadDir := "/tmp/wealthjourney-uploads-test"
	defer func() { _ = os.RemoveAll(testUploadDir) }()

	tests := []struct {
		name        string
		filename    string
		content     string
		shouldError bool
	}{
		{
			name:        "valid CSV upload",
			filename:    "test.csv",
			content:     "date,amount,description\n2024-01-01,100,Test",
			shouldError: false,
		},
		{
			name:        "valid Excel upload",
			filename:    "test.xlsx",
			content:     "mock excel content",
			shouldError: false,
		},
		{
			name:        "valid PDF upload",
			filename:    "test.pdf",
			content:     "mock pdf content",
			shouldError: false,
		},
		{
			name:        "invalid file type",
			filename:    "test.txt",
			content:     "text content",
			shouldError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock multipart file
			mockFile := newMockFile(tt.content)

			// Create multipart header
			header := &multipart.FileHeader{
				Filename: tt.filename,
				Size:     int64(len(tt.content)),
			}

			// Upload file
			result, err := UploadFile(mockFile, header)

			if tt.shouldError {
				if err == nil {
					t.Errorf("Expected error for %s, got none", tt.name)
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error for %s: %v", tt.name, err)
				return
			}

			// Verify result
			if result.FileName != tt.filename {
				t.Errorf("Expected filename %s, got %s", tt.filename, result.FileName)
			}

			if result.FileSize != int64(len(tt.content)) {
				t.Errorf("Expected size %d, got %d", len(tt.content), result.FileSize)
			}

			// Verify file was created
			if _, err := os.Stat(result.FilePath); os.IsNotExist(err) {
				t.Errorf("File was not created at %s", result.FilePath)
			}

			// Verify file content
			savedContent, err := os.ReadFile(result.FilePath)
			if err != nil {
				t.Errorf("Failed to read saved file: %v", err)
			}
			if string(savedContent) != tt.content {
				t.Errorf("File content mismatch. Expected %s, got %s", tt.content, string(savedContent))
			}

			// Clean up
			_ = os.Remove(result.FilePath)
		})
	}
}

func TestUploadFile_EmptyFile(t *testing.T) {
	mockFile := newMockFile("")
	header := &multipart.FileHeader{
		Filename: "empty.csv",
		Size:     0,
	}

	_, err := UploadFile(mockFile, header)
	if err == nil {
		t.Error("Expected error for empty file, got none")
	}
	if !strings.Contains(err.Error(), "empty") {
		t.Errorf("Expected empty file error, got: %v", err)
	}
}

func TestUploadFile_OversizedFile(t *testing.T) {
	mockFile := newMockFile("test")
	header := &multipart.FileHeader{
		Filename: "large.csv",
		Size:     MaxCSVSize + 1,
	}

	_, err := UploadFile(mockFile, header)
	if err == nil {
		t.Error("Expected error for oversized file, got none")
	}
	if !strings.Contains(err.Error(), "file too large") {
		t.Errorf("Expected 'file too large' error, got: %v", err)
	}
	if !strings.Contains(err.Error(), "MB") {
		t.Errorf("Expected error message to include MB unit, got: %v", err)
	}
}

func TestValidateFileSizeMatch(t *testing.T) {
	tests := []struct {
		name          string
		declaredSize  int64
		actualData    []byte
		expectError   bool
		errorContains string
	}{
		{
			name:         "matching sizes",
			declaredSize: 10,
			actualData:   []byte("1234567890"),
			expectError:  false,
		},
		{
			name:          "declared size larger than actual",
			declaredSize:  20,
			actualData:    []byte("1234567890"),
			expectError:   true,
			errorContains: "size mismatch",
		},
		{
			name:          "declared size smaller than actual",
			declaredSize:  5,
			actualData:    []byte("1234567890"),
			expectError:   true,
			errorContains: "size mismatch",
		},
		{
			name:         "both empty",
			declaredSize: 0,
			actualData:   []byte{},
			expectError:  false,
		},
		{
			name:         "large matching sizes",
			declaredSize: 1024 * 1024, // 1MB
			actualData:   make([]byte, 1024*1024),
			expectError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateFileSizeMatch(tt.declaredSize, tt.actualData)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for %s, got none", tt.name)
				} else if tt.errorContains != "" && !strings.Contains(err.Error(), tt.errorContains) {
					t.Errorf("Expected error to contain '%s', got: %v", tt.errorContains, err)
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error for %s, got: %v", tt.name, err)
				}
			}
		})
	}
}

func TestValidateFileSize_UserFriendlyMessages(t *testing.T) {
	tests := []struct {
		name              string
		size              int64
		fileType          FileType
		expectedContains  []string
		expectError       bool
	}{
		{
			name:             "CSV oversized shows MB limit",
			size:             11 * 1024 * 1024,
			fileType:         FileTypeCSV,
			expectedContains: []string{"file too large", "10MB", "csv"},
			expectError:      true,
		},
		{
			name:             "Excel oversized shows MB limit",
			size:             11 * 1024 * 1024,
			fileType:         FileTypeExcel,
			expectedContains: []string{"file too large", "10MB", "excel"},
			expectError:      true,
		},
		{
			name:             "PDF oversized shows MB limit",
			size:             21 * 1024 * 1024,
			fileType:         FileTypePDF,
			expectedContains: []string{"file too large", "20MB", "pdf"},
			expectError:      true,
		},
		{
			name:        "valid CSV size",
			size:        5 * 1024 * 1024,
			fileType:    FileTypeCSV,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateFileSize(tt.size, tt.fileType)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for %s, got none", tt.name)
				} else {
					errMsg := err.Error()
					for _, expectedStr := range tt.expectedContains {
						if !strings.Contains(errMsg, expectedStr) {
							t.Errorf("Expected error message to contain '%s', got: %v", expectedStr, errMsg)
						}
					}
				}
			} else {
				if err != nil {
					t.Errorf("Expected no error for %s, got: %v", tt.name, err)
				}
			}
		})
	}
}

func TestUploadFileFromBytes_SizeMismatch(t *testing.T) {
	tests := []struct {
		name         string
		fileData     []byte
		fileName     string
		declaredSize int64
		expectError  bool
		errorMsg     string
	}{
		{
			name:         "matching size",
			fileData:     []byte("test data"),
			fileName:     "test.csv",
			declaredSize: 9,
			expectError:  false,
		},
		{
			name:         "size mismatch - declared larger",
			fileData:     []byte("test data"),
			fileName:     "test.csv",
			declaredSize: 100,
			expectError:  true,
			errorMsg:     "size mismatch",
		},
		{
			name:         "size mismatch - declared smaller",
			fileData:     []byte("test data"),
			fileName:     "test.csv",
			declaredSize: 5,
			expectError:  true,
			errorMsg:     "size mismatch",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := UploadFileFromBytes(tt.fileData, tt.fileName, tt.declaredSize)
			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error for %s, got none", tt.name)
				} else if !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error to contain '%s', got: %v", tt.errorMsg, err)
				}
			} else {
				if err != nil {
					// Clean up created file if any
					if err == nil {
						_ = CleanupFile(tt.fileName)
					}
					t.Errorf("Expected no error for %s, got: %v", tt.name, err)
				}
				// Clean up on success
				_ = CleanupFile(tt.fileName)
			}
		})
	}
}

func TestCleanupFile(t *testing.T) {
	// Create test file
	testDir := "/tmp/wealthjourney-uploads-test"
	if err := os.MkdirAll(testDir, 0755); err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}
	defer func() { _ = os.RemoveAll(testDir) }()

	// Create test files with same ID but different extensions
	fileID := "test-file-id"
	testFiles := []string{
		filepath.Join(testDir, fileID+".csv"),
		filepath.Join(testDir, fileID+".xlsx"),
	}

	for _, file := range testFiles {
		if err := os.WriteFile(file, []byte("test content"), 0644); err != nil {
			t.Fatalf("Failed to create test file %s: %v", file, err)
		}
	}

	// Verify files exist
	for _, file := range testFiles {
		if _, err := os.Stat(file); os.IsNotExist(err) {
			t.Errorf("Test file was not created: %s", file)
		}
	}

	// Note: CleanupFile uses the const UploadDir, so this test verifies
	// that it doesn't error when cleaning up non-existent files
	err := CleanupFile(fileID)
	if err != nil {
		t.Errorf("CleanupFile should not error: %v", err)
	}

	// Manually clean up test files since CleanupFile uses different directory
	for _, file := range testFiles {
		os.Remove(file)
	}
}

func TestCleanupFile_NonExistentFile(t *testing.T) {
	// Try to cleanup a file that doesn't exist
	err := CleanupFile("non-existent-file-id")
	// Should not return an error even if file doesn't exist (Glob returns empty list)
	if err != nil {
		t.Errorf("CleanupFile should not error for non-existent files, got: %v", err)
	}
}
