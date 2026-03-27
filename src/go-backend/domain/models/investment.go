package models

import (
	"time"

	v1 "wealthjourney/protobuf/v1"

	"gorm.io/gorm"
)

// Investment represents an individual investment holding within a wallet
type Investment struct {
	ID                   int32                        `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID               int32                        `gorm:"not null;default:0;index:idx_investment_user" json:"userId"`
	WalletID             *int32                       `gorm:"index:idx_investment_wallet" json:"walletId"`
	Symbol               string                       `gorm:"size:20;not null;index" json:"symbol"`
	Name                 string                       `gorm:"size:100;not null" json:"name"`
	Type                 int32                        `gorm:"type:int;not null;default:0;index" json:"type"`
	Quantity             int64                        `gorm:"type:bigint;not null;default:0" json:"quantity"`
	AverageCost          int64                        `gorm:"type:bigint;not null;default:0" json:"averageCost"`
	TotalCost            int64                        `gorm:"type:bigint;not null;default:0" json:"totalCost"`
	Currency             string                       `gorm:"size:3;not null;default:'USD'" json:"currency"`
	CurrentPrice         int64                        `gorm:"type:bigint;default:0" json:"currentPrice"`
	CurrentValue         int64                        `gorm:"type:bigint;default:0" json:"currentValue"`
	UnrealizedPNL        int64                        `gorm:"type:bigint;default:0" json:"unrealizedPnl"`
	UnrealizedPNLPercent float64                      `gorm:"type:double precision;default:0" json:"unrealizedPnlPercent"`
	RealizedPNL          int64                        `gorm:"type:bigint;default:0" json:"realizedPnl"`
	TotalDividends       int64                        `gorm:"type:bigint;default:0" json:"totalDividends"`
	PurchaseUnit         string                       `gorm:"size:10;default:'gram'" json:"purchaseUnit"`
	IsCustom             bool                         `gorm:"type:boolean;not null;default:false" json:"isCustom"`
	PriceUpdatedAt       *time.Time                   `gorm:"index" json:"priceUpdatedAt,omitempty"`
	CreatedAt            time.Time                    `json:"createdAt"`
	UpdatedAt            time.Time                    `json:"updatedAt"`
	DeletedAt            gorm.DeletedAt               `gorm:"index" json:"-"`

	// Relationships
	User                 *User                        `gorm:"foreignKey:UserID;constraint:false" json:"user,omitempty"`
	Wallet               *Wallet                      `gorm:"foreignKey:WalletID;constraint:OnDelete:SET NULL" json:"wallet,omitempty"`
}

// TableName specifies the table name for Investment model
func (Investment) TableName() string {
	return "investment"
}

// BeforeCreate GORM hook to recalculate derived fields before creation
func (i *Investment) BeforeCreate(tx *gorm.DB) error {
	i.Recalculate()
	return nil
}

// BeforeUpdate GORM hook to recalculate derived fields before update
func (i *Investment) BeforeUpdate(tx *gorm.DB) error {
	i.Recalculate()
	return nil
}

// Recalculate updates CurrentValue, UnrealizedPNL, UnrealizedPNLPercent based on investment type
// Both CurrentPrice and CurrentValue are stored in cents (currency's smallest unit)
func (i *Investment) Recalculate() {
	if i.Quantity > 0 && i.CurrentPrice > 0 {
		// Determine divisor based on investment type
		// Default to 4 decimals (10000) for most investment types including OTHER (custom investments)
		var divisor int64 = 10000 // Default: 4 decimals
		switch v1.InvestmentType(i.Type) {
		case v1.InvestmentType_INVESTMENT_TYPE_CRYPTOCURRENCY:
			divisor = 100000000 // 8 decimals for satoshis
		case v1.InvestmentType_INVESTMENT_TYPE_STOCK,
			v1.InvestmentType_INVESTMENT_TYPE_ETF,
			v1.InvestmentType_INVESTMENT_TYPE_MUTUAL_FUND,
			v1.InvestmentType_INVESTMENT_TYPE_BOND,
			v1.InvestmentType_INVESTMENT_TYPE_COMMODITY,
			v1.InvestmentType_INVESTMENT_TYPE_OTHER:
			divisor = 10000 // 4 decimals for stocks, bonds, commodities, and other investments
		case v1.InvestmentType_INVESTMENT_TYPE_GOLD_VND,
			v1.InvestmentType_INVESTMENT_TYPE_GOLD_USD,
			v1.InvestmentType_INVESTMENT_TYPE_SILVER_VND,
			v1.InvestmentType_INVESTMENT_TYPE_SILVER_USD:
			divisor = 10000 // 4 decimals for gold/silver (grams × 10000 or ounces × 10000)
		}

		// Current Value = (Quantity / divisor) * CurrentPrice
		// - divisor converts quantity from storage units to whole units (e.g., satoshis to BTC)
		// - CurrentPrice is in cents, so CurrentValue will also be in cents
		// Using float64 for intermediate calculation to avoid integer overflow with large quantities
		quantityWholeUnits := float64(i.Quantity) / float64(divisor)
		i.CurrentValue = int64(quantityWholeUnits * float64(i.CurrentPrice))
		i.UnrealizedPNL = i.CurrentValue - i.TotalCost
		if i.TotalCost > 0 {
			i.UnrealizedPNLPercent = (float64(i.UnrealizedPNL) / float64(i.TotalCost)) * 100
		}
	} else {
		// If quantity or price is zero, current value is zero
		i.CurrentValue = 0

		// If we have cost but no quantity/price, that's a 100% loss
		if i.TotalCost > 0 {
			i.UnrealizedPNL = -i.TotalCost
			i.UnrealizedPNLPercent = -100.0
		} else {
			// No cost, no PNL
			i.UnrealizedPNL = 0
			i.UnrealizedPNLPercent = 0
		}
	}
}

// DerefInt32 safely dereferences an *int32 pointer, returning 0 if nil.
func DerefInt32(p *int32) int32 {
	if p != nil {
		return *p
	}
	return 0
}

// ToProto converts the model to protobuf message
func (i *Investment) ToProto() *v1.Investment {
	return &v1.Investment{
		Id:                   i.ID,
		UserId:               i.UserID,
		WalletId:             DerefInt32(i.WalletID),
		Symbol:               i.Symbol,
		Name:                 i.Name,
		Type:                 v1.InvestmentType(i.Type), // Convert int32 to enum
		Quantity:             i.Quantity,
		AverageCost:          i.AverageCost,
		TotalCost:            i.TotalCost,
		Currency:             i.Currency,
		CurrentPrice:         i.CurrentPrice,
		CurrentValue:         i.CurrentValue,
		UnrealizedPnl:        i.UnrealizedPNL,
		UnrealizedPnlPercent: i.UnrealizedPNLPercent,
		RealizedPnl:          i.RealizedPNL,
		TotalDividends:       i.TotalDividends,
		PurchaseUnit:         i.PurchaseUnit,
		IsCustom:             i.IsCustom,
		CreatedAt:            i.CreatedAt.Unix(),
		UpdatedAt:            i.UpdatedAt.Unix(),
	}
}
