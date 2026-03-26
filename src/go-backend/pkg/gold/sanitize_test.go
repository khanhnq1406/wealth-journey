package gold

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSanitizeTypeCode(t *testing.T) {
	tests := []struct{ input, prefix, want string }{
		{"SJC 1L - 10L - 1KG", "SJC", "SJC_SJC_1L_10L_1KG"},
		{"Nhẫn Tròn 9999", "DOJI", "DOJI_NHAN_TRON_9999"},
		{"Nữ trang 99.99%", "SJC", "SJC_NU_TRANG_99_99"},
		{"999.9", "PNJ", "PNJ_999_9"},
		{"Vàng miếng VRTL", "BTMC", "BTMC_VANG_MIENG_VRTL"},
		{"<script>alert(1)</script>", "SJC", "SJC_SCRIPT_ALERT_1_SCRIPT"},
	}
	for _, tt := range tests {
		got := SanitizeTypeCode(tt.prefix, tt.input)
		assert.Equal(t, tt.want, got)
		assert.LessOrEqual(t, len(got), 50)
	}
}

func TestSanitizeTypeCode_EdgeCases(t *testing.T) {
	t.Run("empty input does not panic", func(t *testing.T) {
		got := SanitizeTypeCode("SJC", "")
		// Empty input: prefix + "_" + "" → trim trailing underscore → just "SJC"
		assert.NotEmpty(t, got)
		assert.LessOrEqual(t, len(got), 50)
	})

	t.Run("max length enforcement", func(t *testing.T) {
		longInput := strings.Repeat("A", 100)
		got := SanitizeTypeCode("SJC", longInput)
		assert.LessOrEqual(t, len(got), 50)
	})

	t.Run("only special chars", func(t *testing.T) {
		got := SanitizeTypeCode("PNJ", "!!!@@@###")
		assert.LessOrEqual(t, len(got), 50)
		// Result must only contain uppercase alphanumeric and underscore
		for _, r := range got {
			assert.True(t, (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_',
				"unexpected char %q in %q", r, got)
		}
	})

	t.Run("result only alphanumeric and underscore", func(t *testing.T) {
		got := SanitizeTypeCode("BTMC", "Vàng miếng VRTL")
		for _, r := range got {
			assert.True(t, (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_',
				"unexpected char %q in %q", r, got)
		}
	})

	t.Run("injection attempt - SQL", func(t *testing.T) {
		got := SanitizeTypeCode("SJC", "'; DROP TABLE gold; --")
		assert.LessOrEqual(t, len(got), 50)
		for _, r := range got {
			assert.True(t, (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_',
				"unexpected char %q in %q", r, got)
		}
	})
}
