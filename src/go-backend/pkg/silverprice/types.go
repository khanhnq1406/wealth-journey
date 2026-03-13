package silverprice

// ExternalSilverPrice represents a silver price from an external source
type ExternalSilverPrice struct {
	Name   string // Display name (e.g., "Phu Quy thoi 1L")
	Buy    int64  // Price in VND
	Sell   int64  // Price in VND
	Source string // "phuquy", "ancarat", "doji", "sbj"
}
