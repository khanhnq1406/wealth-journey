package sjc

import "time"

// GoldPrice holds a parsed gold price entry from the SJC API.
type GoldPrice struct {
	TypeCode   string
	Name       string
	Buy        int64
	Sell       int64
	ChangeBuy  int64
	ChangeSell int64
	Currency   string
	UpdateTime time.Time
}

// SJC API response structures (unexported — internal parsing only)

type apiResponse struct {
	DataList struct {
		Data []apiRow `json:"Data"`
	} `json:"DataList"`
}

type apiRow struct {
	TypeName        string  `json:"TypeName"`
	BuyValue        float64 `json:"BuyValue"`
	SellValue       float64 `json:"SellValue"`
	BuyDifferValue  int64   `json:"BuyDifferValue"`
	SellDifferValue int64   `json:"SellDifferValue"`
}
