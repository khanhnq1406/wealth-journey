package imaging

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/draw"
	"image/gif"
	"image/jpeg"
	"image/png"
)

// ValidateMagicBytes checks magic bytes to identify image type.
// Returns detected MIME type or error if not a supported image.
func ValidateMagicBytes(data []byte) (string, error) {
	if len(data) < 12 {
		return "", errors.New("file too small to detect image type")
	}

	// JPEG: FF D8 FF
	if data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return "image/jpeg", nil
	}

	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
		return "image/png", nil
	}

	// GIF: 47 49 46 38
	if data[0] == 0x47 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x38 {
		return "image/gif", nil
	}

	// WebP: RIFF????WEBP
	if data[0] == 0x52 && data[1] == 0x49 && data[2] == 0x46 && data[3] == 0x46 &&
		len(data) >= 12 && data[8] == 0x57 && data[9] == 0x45 && data[10] == 0x42 && data[11] == 0x50 {
		return "image/webp", nil
	}

	return "", errors.New("unsupported image format: not JPEG, PNG, GIF, or WebP")
}

// ResizeImage resizes an image if it exceeds maxWidth, maintaining aspect ratio.
// Also strips EXIF metadata by re-encoding through Go's image library.
// Returns the resized image bytes in the same format as input.
func ResizeImage(data []byte, mimeType string, maxWidth int) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("failed to decode image: %w", err)
	}

	bounds := img.Bounds()
	origWidth := bounds.Dx()
	origHeight := bounds.Dy()

	// Only resize if image is wider than maxWidth
	if origWidth <= maxWidth {
		// Re-encode to strip EXIF metadata even without resizing
		return encodeImage(img, mimeType)
	}

	// Calculate new dimensions maintaining aspect ratio
	newWidth := maxWidth
	newHeight := (origHeight * maxWidth) / origWidth

	// Simple resize using standard library with nearest-neighbor interpolation
	dst := image.NewRGBA(image.Rect(0, 0, newWidth, newHeight))
	for y := 0; y < newHeight; y++ {
		for x := 0; x < newWidth; x++ {
			srcX := x * origWidth / newWidth
			srcY := y * origHeight / newHeight
			dst.Set(x, y, img.At(srcX, srcY))
		}
	}

	return encodeImage(dst, mimeType)
}

// scaleNRGBA is a helper to scale images using draw package for NRGBA output.
func scaleNRGBA(src image.Image, newWidth, newHeight int) *image.NRGBA {
	dst := image.NewNRGBA(image.Rect(0, 0, newWidth, newHeight))
	draw.Draw(dst, dst.Bounds(), src, image.Point{}, draw.Src)
	return dst
}

func encodeImage(img image.Image, mimeType string) ([]byte, error) {
	var buf bytes.Buffer

	switch mimeType {
	case "image/jpeg":
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
			return nil, fmt.Errorf("failed to encode JPEG: %w", err)
		}
	case "image/png":
		if err := png.Encode(&buf, img); err != nil {
			return nil, fmt.Errorf("failed to encode PNG: %w", err)
		}
	case "image/gif":
		if err := gif.Encode(&buf, img, nil); err != nil {
			return nil, fmt.Errorf("failed to encode GIF: %w", err)
		}
	case "image/webp":
		// WebP not natively supported by Go standard library — encode as JPEG
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 85}); err != nil {
			return nil, fmt.Errorf("failed to encode WebP as JPEG: %w", err)
		}
		return buf.Bytes(), nil
	default:
		return nil, fmt.Errorf("unsupported MIME type for encoding: %s", mimeType)
	}

	return buf.Bytes(), nil
}

// MimeTypeToExtension returns the file extension for a MIME type.
func MimeTypeToExtension(mimeType string) string {
	switch mimeType {
	case "image/jpeg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/gif":
		return "gif"
	case "image/webp":
		return "jpg" // converted to JPEG
	default:
		return "jpg"
	}
}
