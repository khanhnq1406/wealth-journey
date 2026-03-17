package models

import (
	"time"

	investmentv1 "wealthjourney/protobuf/v1"

	"gorm.io/gorm"
)

// InvestmentTransaction represents a buy or sell transaction for an investment
type InvestmentTransaction struct {
	ID                int32     `gorm:"primaryKey;autoIncrement" json:"id"`
	InvestmentID      int32     `gorm:"not null;index:idx_tx_investment" json:"investmentId"`
	UserID            int32     `gorm:"not null;default:0;index:idx_investment_tx_user" json:"userId"`
	WalletID          *int32    `gorm:"index:idx_tx_wallet" json:"walletId"`
	Type              int32     `gorm:"type:int;not null;default:0" json:"type"`
	Quantity          int64     `gorm:"type:bigint;not null" json:"quantity"`
	Price             int64     `gorm:"type:bigint;not null" json:"price"`
	Cost              int64     `gorm:"type:bigint;not null" json:"cost"`
	Currency          string    `gorm:"size:3;not null;default:'USD'" json:"currency"`
	Fees              int64     `gorm:"type:bigint;default:0" json:"fees"`
	TransactionDate   time.Time `gorm:"not null;index" json:"transactionDate"`
	Notes             string    `gorm:"type:text" json:"notes"`
	LotID             *int32    `gorm:"index" json:"lotId,omitempty"`
	RemainingQuantity int64     `gorm:"type:bigint;default:0;not null" json:"remainingQuantity"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Investment *Investment     `gorm:"foreignKey:InvestmentID" json:"investment,omitempty"`
	Wallet     *Wallet         `gorm:"foreignKey:WalletID" json:"wallet,omitempty"`
	Lot        *InvestmentLot  `gorm:"foreignKey:LotID" json:"lot,omitempty"`
}

// TableName specifies the table name for InvestmentTransaction model
func (InvestmentTransaction) TableName() string {
	return "investment_transaction"
}

// ToProto converts the model to protobuf message
func (tx *InvestmentTransaction) ToProto() *investmentv1.InvestmentTransaction {
	var lotID int32
	if tx.LotID != nil {
		lotID = *tx.LotID
	}

	return &investmentv1.InvestmentTransaction{
		Id:                tx.ID,
		InvestmentId:      tx.InvestmentID,
		WalletId:          DerefInt32(tx.WalletID),
		Type:              investmentv1.InvestmentTransactionType(tx.Type), // Convert int32 to enum
		Quantity:          tx.Quantity,
		Price:             tx.Price,
		Cost:              tx.Cost,
		Fees:              tx.Fees,
		TransactionDate:   tx.TransactionDate.Unix(),
		Notes:             tx.Notes,
		LotId:             lotID,
		RemainingQuantity: int32(tx.RemainingQuantity),
		CreatedAt:         tx.CreatedAt.Unix(),
		UpdatedAt:         tx.UpdatedAt.Unix(),
	}
}
