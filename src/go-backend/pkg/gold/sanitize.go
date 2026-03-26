package gold

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

var sanitizeRe = regexp.MustCompile(`[^A-Z0-9_]`)

// SanitizeTypeCode converts a raw name to an uppercase, alphanumeric+underscore
// type code with the given prefix. Result is max 50 chars.
// This is a security boundary: prevents injection of arbitrary strings into the DB.
func SanitizeTypeCode(prefix, name string) string {
	s := removeDiacritics(name)
	s = strings.ToUpper(s)
	s = sanitizeRe.ReplaceAllString(s, "_")
	// Collapse multiple underscores
	for strings.Contains(s, "__") {
		s = strings.ReplaceAll(s, "__", "_")
	}
	s = strings.Trim(s, "_")
	if s == "" {
		result := prefix
		if len(result) > 50 {
			result = result[:50]
		}
		return result
	}
	result := prefix + "_" + s
	if len(result) > 50 {
		result = result[:50]
	}
	return result
}

// removeDiacritics strips Unicode combining marks (accents, diacritics) from s,
// returning ASCII-friendly characters. For example "Nhẫn" → "Nhan".
func removeDiacritics(s string) string {
	var b strings.Builder
	for _, r := range norm.NFD.String(s) {
		if !unicode.Is(unicode.Mn, r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}
