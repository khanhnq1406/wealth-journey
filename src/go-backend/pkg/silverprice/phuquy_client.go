package silverprice

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const phuQuyURL = "https://giabac.phuquygroup.vn/PhuQuyPrice/SilverPricePartial"

// PhuQuyClient fetches silver prices from Phu Quy
type PhuQuyClient struct {
	httpClient *http.Client
}

// NewPhuQuyClient creates a new Phu Quy client
func NewPhuQuyClient() *PhuQuyClient {
	return &PhuQuyClient{
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// FetchPrices fetches silver prices from Phu Quy
func (c *PhuQuyClient) FetchPrices(ctx context.Context) ([]ExternalSilverPrice, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", phuQuyURL, nil)
	if err != nil {
		return nil, fmt.Errorf("create phuquy request: %w", err)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch phuquy prices: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("phuquy unexpected status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1MB limit
	if err != nil {
		return nil, fmt.Errorf("read phuquy response: %w", err)
	}

	return parsePhuQuyHTML(string(body))
}

// parsePhuQuyHTML parses the HTML table from Phu Quy API
func parsePhuQuyHTML(html string) ([]ExternalSilverPrice, error) {
	var prices []ExternalSilverPrice

	// Extract table rows using regex
	rowRe := regexp.MustCompile(`(?s)<tr[^>]*>(.*?)</tr>`)
	cellRe := regexp.MustCompile(`(?s)<td[^>]*>(.*?)</td>`)
	tagRe := regexp.MustCompile(`<[^>]*>`)

	rows := rowRe.FindAllStringSubmatch(html, -1)

	for _, row := range rows {
		cells := cellRe.FindAllStringSubmatch(row[1], -1)
		// Phú Quý HTML has 4 columns: Product | Unit | Buy (GIÁ MUA VÀO) | Sell (GIÁ BÁN RA)
		if len(cells) < 4 {
			continue
		}

		// Clean cell content by removing HTML tags
		name := strings.TrimSpace(tagRe.ReplaceAllString(cells[0][1], ""))
		// cells[1] is the unit column (ĐƠN VỊ) — skip it
		buyStr := strings.TrimSpace(tagRe.ReplaceAllString(cells[2][1], ""))
		sellStr := strings.TrimSpace(tagRe.ReplaceAllString(cells[3][1], ""))

		// Skip header rows
		nameLower := strings.ToLower(name)
		if strings.Contains(nameLower, "sản phẩm") || strings.Contains(nameLower, "loại") || name == "" {
			continue
		}

		buy := parseVNDPrice(buyStr)
		sell := parseVNDPrice(sellStr)
		if buy == 0 && sell == 0 {
			continue
		}

		displayName := mapPhuQuyName(name)
		if displayName == "" {
			continue
		}

		prices = append(prices, ExternalSilverPrice{
			Name:   displayName,
			Buy:    buy,
			Sell:   sell,
			Source: "phuquy",
		})
	}

	return prices, nil
}

// mapPhuQuyName maps Phu Quy product names to display names
func mapPhuQuyName(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "mỹ nghệ") || strings.Contains(lower, "trang sức"):
		return "Bạc Mỹ nghệ Phú Quý"
	case strings.Contains(lower, "kg") || strings.Contains(lower, "1 kg"):
		return "Phú Quý 999 - 1Kg"
	case strings.Contains(lower, "5 lượng") || strings.Contains(lower, "10 lượng"):
		return "Phú Quý thỏi 5L,10L"
	case strings.Contains(lower, "1 lượng"):
		return "Phú Quý thỏi 1L"
	default:
		return ""
	}
}

// parseVNDPrice parses a VND price string like "3,050,000" to int64
func parseVNDPrice(s string) int64 {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, ",", "")
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, " ", "")
	if s == "" || s == "-" || s == "--" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}
