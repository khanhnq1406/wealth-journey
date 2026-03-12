package fileupload

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestListFiles(t *testing.T) {
	// Create a temporary upload directory
	tempDir := filepath.Join(os.TempDir(), "test-upload-"+time.Now().Format("20060102150405"))
	defer func() { _ = os.RemoveAll(tempDir) }()

	// Create some test files
	testFiles := []string{
		"file1.csv",
		"file2.xlsx",
		"file3.pdf",
	}

	if err := os.MkdirAll(tempDir, 0755); err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	for _, filename := range testFiles {
		filePath := filepath.Join(tempDir, filename)
		if err := os.WriteFile(filePath, []byte("test data"), 0644); err != nil {
			t.Fatalf("Failed to create test file %s: %v", filename, err)
		}
	}

	// List files
	files, err := ListFiles(tempDir)
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}

	// Verify count
	if len(files) != len(testFiles) {
		t.Errorf("Expected %d files, got %d", len(testFiles), len(files))
	}

	// Verify each file has metadata
	for _, file := range files {
		if file.Path == "" {
			t.Error("File path is empty")
		}
		if file.ModTime == nil {
			t.Error("File ModTime is nil")
		}
		if file.Size == 0 {
			t.Error("File size is 0")
		}
	}
}

func TestListFiles_EmptyDirectory(t *testing.T) {
	// Create a temporary empty directory
	tempDir := filepath.Join(os.TempDir(), "test-empty-"+time.Now().Format("20060102150405"))
	defer func() { _ = os.RemoveAll(tempDir) }()

	if err := os.MkdirAll(tempDir, 0755); err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	// List files in empty directory
	files, err := ListFiles(tempDir)
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}

	// Verify empty result
	if len(files) != 0 {
		t.Errorf("Expected 0 files, got %d", len(files))
	}
}

func TestListFiles_NonExistentDirectory(t *testing.T) {
	// Try to list files in non-existent directory
	_, err := ListFiles("/nonexistent/path/that/does/not/exist")
	if err == nil {
		t.Error("Expected error for non-existent directory, got nil")
	}
}

func TestDeleteFile(t *testing.T) {
	// Create a temporary file
	tempFile := filepath.Join(os.TempDir(), "test-delete-"+time.Now().Format("20060102150405")+".txt")
	defer os.Remove(tempFile) // cleanup in case test fails

	if err := os.WriteFile(tempFile, []byte("test data"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Delete the file
	if err := DeleteFile(tempFile); err != nil {
		t.Fatalf("DeleteFile failed: %v", err)
	}

	// Verify file is deleted
	if _, err := os.Stat(tempFile); !os.IsNotExist(err) {
		t.Error("File was not deleted")
	}
}

func TestDeleteFile_NonExistent(t *testing.T) {
	// Try to delete non-existent file (should not error)
	err := DeleteFile("/nonexistent/file.txt")
	if err != nil {
		t.Errorf("DeleteFile should not error on non-existent file: %v", err)
	}
}

func TestFileCleanup_Integration(t *testing.T) {
	// Create a temporary upload directory
	tempDir := filepath.Join(os.TempDir(), "test-cleanup-"+time.Now().Format("20060102150405"))
	defer func() { _ = os.RemoveAll(tempDir) }()

	if err := os.MkdirAll(tempDir, 0755); err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	// Create old file (2 hours ago)
	oldFile := filepath.Join(tempDir, "old-file.csv")
	if err := os.WriteFile(oldFile, []byte("old data"), 0644); err != nil {
		t.Fatalf("Failed to create old file: %v", err)
	}
	twoHoursAgo := time.Now().Add(-2 * time.Hour)
	if err := os.Chtimes(oldFile, twoHoursAgo, twoHoursAgo); err != nil {
		t.Fatalf("Failed to set old file time: %v", err)
	}

	// Create recent file (30 minutes ago)
	recentFile := filepath.Join(tempDir, "recent-file.csv")
	if err := os.WriteFile(recentFile, []byte("recent data"), 0644); err != nil {
		t.Fatalf("Failed to create recent file: %v", err)
	}
	thirtyMinutesAgo := time.Now().Add(-30 * time.Minute)
	if err := os.Chtimes(recentFile, thirtyMinutesAgo, thirtyMinutesAgo); err != nil {
		t.Fatalf("Failed to set recent file time: %v", err)
	}

	// List all files
	files, err := ListFiles(tempDir)
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}

	if len(files) != 2 {
		t.Fatalf("Expected 2 files, got %d", len(files))
	}

	// Simulate cleanup: delete files older than 1 hour
	cutoffTime := time.Now().Add(-1 * time.Hour)
	var deletedCount int

	for _, file := range files {
		if file.ModTime.ModTime().Before(cutoffTime) {
			if err := DeleteFile(file.Path); err != nil {
				t.Errorf("Failed to delete old file: %v", err)
			}
			deletedCount++
		}
	}

	// Verify results
	if deletedCount != 1 {
		t.Errorf("Expected 1 file to be deleted, got %d", deletedCount)
	}

	// Verify old file is deleted
	if _, err := os.Stat(oldFile); !os.IsNotExist(err) {
		t.Error("Old file was not deleted")
	}

	// Verify recent file still exists
	if _, err := os.Stat(recentFile); err != nil {
		t.Error("Recent file was incorrectly deleted")
	}
}

func TestFileCleanup_ContinuesOnError(t *testing.T) {
	// Create a temporary upload directory
	tempDir := filepath.Join(os.TempDir(), "test-error-"+time.Now().Format("20060102150405"))
	defer func() { _ = os.RemoveAll(tempDir) }()

	if err := os.MkdirAll(tempDir, 0755); err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	// Create multiple old files
	for i := 1; i <= 5; i++ {
		filename := filepath.Join(tempDir, filepath.Base(tempDir)+"-file-"+string(rune('0'+i))+".csv")
		if err := os.WriteFile(filename, []byte("data"), 0644); err != nil {
			t.Fatalf("Failed to create test file: %v", err)
		}
		twoHoursAgo := time.Now().Add(-2 * time.Hour)
		if err := os.Chtimes(filename, twoHoursAgo, twoHoursAgo); err != nil {
			t.Fatalf("Failed to set file time: %v", err)
		}
	}

	// List files
	files, err := ListFiles(tempDir)
	if err != nil {
		t.Fatalf("ListFiles failed: %v", err)
	}

	if len(files) != 5 {
		t.Fatalf("Expected 5 files, got %d", len(files))
	}

	// Delete first file manually to simulate already-deleted file
	if len(files) > 0 {
		_ = DeleteFile(files[0].Path)
	}

	// Now try to delete all old files (including the one already deleted)
	cutoffTime := time.Now().Add(-1 * time.Hour)
	var successCount int
	var errorCount int

	for _, file := range files {
		if file.ModTime.ModTime().Before(cutoffTime) {
			if err := DeleteFile(file.Path); err != nil {
				errorCount++
				// Continue with other files
				continue
			}
			successCount++
		}
	}

	// Verify cleanup succeeded for all files
	// DeleteFile is idempotent, so deleting an already-deleted file doesn't error
	if successCount != 5 {
		t.Errorf("Expected 5 files to be deleted successfully, got %d", successCount)
	}

	// errorCount should be 0 because DeleteFile doesn't error on non-existent files
	if errorCount != 0 {
		t.Errorf("Expected 0 errors during cleanup (DeleteFile is idempotent), got %d", errorCount)
	}
}
