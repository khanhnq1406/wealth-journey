package fileupload

import (
	"fmt"
	"path/filepath"
	"strings"
)

func ValidateFileType(filename string) (FileType, error) {
	ext := strings.ToLower(filepath.Ext(filename))

	switch ext {
	case ".xlsx", ".xls":
		return FileTypeExcel, nil
	case ".pdf":
		return FileTypePDF, nil
	default:
		return "", fmt.Errorf("unsupported file type: %s. Supported: Excel (.xlsx, .xls), PDF", ext)
	}
}

func ValidateFileSize(size int64, fileType FileType) error {
	var maxSize int64

	switch fileType {
	case FileTypeExcel:
		maxSize = MaxExcelSize
	case FileTypePDF:
		maxSize = MaxPDFSize
	default:
		return fmt.Errorf("unknown file type")
	}

	if size > maxSize {
		maxSizeMB := maxSize / (1024 * 1024)
		return fmt.Errorf("file too large: max size is %dMB for %s files", maxSizeMB, fileType)
	}

	if size == 0 {
		return fmt.Errorf("file is empty")
	}

	return nil
}

// ValidateFileSizeMatch validates that declared size matches actual data size
func ValidateFileSizeMatch(declaredSize int64, actualData []byte) error {
	actualSize := int64(len(actualData))
	if actualSize != declaredSize {
		return fmt.Errorf("file size mismatch: declared %d bytes, actual %d bytes", declaredSize, actualSize)
	}
	return nil
}
