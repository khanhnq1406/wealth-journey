package fileupload

import (
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"unicode"
)

// Allowed MIME types for uploads
var allowedMIMETypes = map[string][]string{
	".xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip", "application/octet-stream"},
	".xls":  {"application/vnd.ms-excel", "application/octet-stream"},
	".pdf":  {"application/pdf"},
}

// ValidateMIMEType validates the actual file content MIME type against expected types for the extension.
// This prevents file type spoofing by reading the first 512 bytes and detecting the actual MIME type.
func ValidateMIMEType(fileContent []byte, fileName string) error {
	// Get file extension
	ext := strings.ToLower(filepath.Ext(fileName))

	// Check if extension is allowed
	expectedMIMETypes, ok := allowedMIMETypes[ext]
	if !ok {
		return fmt.Errorf("unsupported file extension: %s", ext)
	}

	// Read first 512 bytes for MIME detection (or less if file is smaller)
	sampleSize := 512
	if len(fileContent) < sampleSize {
		sampleSize = len(fileContent)
	}

	if sampleSize == 0 {
		return fmt.Errorf("file is empty")
	}

	// Detect MIME type from content
	detectedMIME := http.DetectContentType(fileContent[:sampleSize])

	// For text files, DetectContentType might return "text/plain; charset=utf-8"
	// We need to extract just the MIME type part
	detectedMIME = strings.Split(detectedMIME, ";")[0]
	detectedMIME = strings.TrimSpace(detectedMIME)

	// Check if detected MIME type matches any expected type
	for _, expectedMIME := range expectedMIMETypes {
		if detectedMIME == expectedMIME {
			return nil
		}
	}

	return fmt.Errorf("file type mismatch: file has extension %s but content type is %s (expected: %v)",
		ext, detectedMIME, expectedMIMETypes)
}

// SanitizeFileName removes dangerous characters and patterns from filenames to prevent path traversal
// and other security issues.
func SanitizeFileName(fileName string) (string, error) {
	if fileName == "" {
		return "", fmt.Errorf("filename cannot be empty")
	}

	// Remove any path separators to prevent directory traversal
	fileName = filepath.Base(fileName)

	// Remove null bytes
	fileName = strings.ReplaceAll(fileName, "\x00", "")

	// Remove control characters (ASCII 0-31 and 127)
	var sanitized strings.Builder
	for _, r := range fileName {
		if r < 32 || r == 127 {
			continue // Skip control characters
		}
		sanitized.WriteRune(r)
	}
	fileName = sanitized.String()

	// Check for dangerous patterns
	dangerous := []string{
		"..", // Path traversal
		"./", // Relative path
		"../", // Parent directory
		"\\", // Windows path separator
	}

	lowerFileName := strings.ToLower(fileName)
	for _, pattern := range dangerous {
		if strings.Contains(lowerFileName, pattern) {
			return "", fmt.Errorf("filename contains dangerous pattern: %s", pattern)
		}
	}

	// Remove leading/trailing whitespace and dots
	fileName = strings.TrimSpace(fileName)
	fileName = strings.Trim(fileName, ".")

	// Validate filename length (max 255 characters)
	if len(fileName) > 255 {
		// Truncate but preserve extension
		ext := filepath.Ext(fileName)
		nameWithoutExt := strings.TrimSuffix(fileName, ext)
		maxNameLength := 255 - len(ext)
		if maxNameLength > 0 {
			// Truncate name part
			runes := []rune(nameWithoutExt)
			if len(runes) > maxNameLength {
				nameWithoutExt = string(runes[:maxNameLength])
			}
			fileName = nameWithoutExt + ext
		} else {
			return "", fmt.Errorf("filename too long (max 255 characters)")
		}
	}

	// Ensure filename is not empty after sanitization
	if fileName == "" || fileName == "." {
		return "", fmt.Errorf("filename is invalid after sanitization")
	}

	// Ensure filename has an extension
	if filepath.Ext(fileName) == "" {
		return "", fmt.Errorf("filename must have an extension")
	}

	return fileName, nil
}

// ValidateFileContent validates the entire file content for security issues.
func ValidateFileContent(fileContent []byte, fileName string) error {
	// Sanitize filename
	sanitizedName, err := SanitizeFileName(fileName)
	if err != nil {
		return fmt.Errorf("invalid filename: %w", err)
	}

	// Validate MIME type
	if err := ValidateMIMEType(fileContent, sanitizedName); err != nil {
		return fmt.Errorf("invalid file type: %w", err)
	}

	return nil
}

// SanitizeString removes control characters and dangerous content from strings.
func SanitizeString(input string, maxLength int) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")

	// Remove control characters except newline, tab, and carriage return
	var sanitized strings.Builder
	for _, r := range input {
		if unicode.IsControl(r) {
			// Keep only these control characters
			if r == '\n' || r == '\t' || r == '\r' {
				sanitized.WriteRune(r)
			}
			// Skip all other control characters
			continue
		}
		sanitized.WriteRune(r)
	}

	result := sanitized.String()

	// Trim to max length if specified
	if maxLength > 0 && len(result) > maxLength {
		runes := []rune(result)
		if len(runes) > maxLength {
			result = string(runes[:maxLength])
		}
	}

	return strings.TrimSpace(result)
}
