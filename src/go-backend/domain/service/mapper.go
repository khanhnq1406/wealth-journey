package service

import (
	"wealthjourney/domain/models"
	"wealthjourney/pkg/types"
	v1 "wealthjourney/protobuf/v1"
)

// WalletMapper handles conversion between domain models and proto types.
type WalletMapper struct{}

// NewWalletMapper creates a new WalletMapper.
func NewWalletMapper() *WalletMapper {
	return &WalletMapper{}
}

// ModelToProto converts a Wallet domain model to proto Wallet type.
func (m *WalletMapper) ModelToProto(wallet *models.Wallet) *v1.Wallet {
	if wallet == nil {
		return nil
	}

	return &v1.Wallet{
		Id:         wallet.ID,
		UserId:     wallet.UserID,
		WalletName: wallet.WalletName,
		Balance: &v1.Money{
			Amount:   wallet.Balance,
			Currency: wallet.Currency,
		},
		CreatedAt: wallet.CreatedAt.Unix(),
		UpdatedAt: wallet.UpdatedAt.Unix(),
		Type:      v1.WalletType(wallet.Type),
		Status:    v1.WalletStatus(wallet.Status),
		Currency:  wallet.Currency,
	}
}

// ModelSliceToProto converts a slice of Wallet models to proto Wallets.
func (m *WalletMapper) ModelSliceToProto(wallets []*models.Wallet) []*v1.Wallet {
	if wallets == nil {
		return nil
	}

	result := make([]*v1.Wallet, len(wallets))
	for i, w := range wallets {
		result[i] = m.ModelToProto(w)
	}
	return result
}

// PaginationResultToProto converts service PaginationResult to proto.
func (m *WalletMapper) PaginationResultToProto(result types.PaginationResult) *v1.PaginationResult {
	return &v1.PaginationResult{
		Page:       int32(result.Page),
		PageSize:   int32(result.PageSize),
		TotalCount: int32(result.TotalCount),
		TotalPages: int32(result.TotalPages),
	}
}

// UserMapper handles conversion between domain models and proto types.
type UserMapper struct{}

// NewUserMapper creates a new UserMapper.
func NewUserMapper() *UserMapper {
	return &UserMapper{}
}

// ModelToProto converts a User domain model to proto User type.
func (m *UserMapper) ModelToProto(user *models.User) *v1.User {
	if user == nil {
		return nil
	}

	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	return &v1.User{
		Id:                   user.ID,
		Email:                email,
		Name:                 user.Name,
		Picture:              user.Picture,
		PreferredCurrency:    user.PreferredCurrency,
		ConversionInProgress: user.ConversionInProgress,
		PreferredLanguage:    user.PreferredLanguage,
		CreatedAt:            user.CreatedAt.Unix(),
		UpdatedAt:            user.UpdatedAt.Unix(),
	}
}

// ModelSliceToProto converts a slice of User models to proto Users.
func (m *UserMapper) ModelSliceToProto(users []*models.User) []*v1.User {
	if users == nil {
		return nil
	}

	result := make([]*v1.User, len(users))
	for i, u := range users {
		result[i] = m.ModelToProto(u)
	}
	return result
}

// PaginationResultToProto converts service PaginationResult to proto.
func (m *UserMapper) PaginationResultToProto(result types.PaginationResult) *v1.PaginationResult {
	return &v1.PaginationResult{
		Page:       int32(result.Page),
		PageSize:   int32(result.PageSize),
		TotalCount: int32(result.TotalCount),
		TotalPages: int32(result.TotalPages),
	}
}

// BudgetMapper handles conversion between budget domain models and proto types.
type BudgetMapper struct{}

// NewBudgetMapper creates a new BudgetMapper.
func NewBudgetMapper() *BudgetMapper {
	return &BudgetMapper{}
}

// ModelToProto converts a Budget domain model to proto Budget type.
func (m *BudgetMapper) ModelToProto(budget *models.Budget) *v1.Budget {
	if budget == nil {
		return nil
	}

	// Use budget's currency field, fallback to VND if not set
	currency := budget.Currency
	if currency == "" {
		currency = types.VND
	}

	return &v1.Budget{
		Id:        budget.ID,
		UserId:    budget.UserID,
		Name:      budget.Name,
		Total: &v1.Money{
			Amount:   budget.Total,
			Currency: currency,
		},
		CreatedAt: budget.CreatedAt.Unix(),
		UpdatedAt: budget.UpdatedAt.Unix(),
		Currency:  currency,
	}
}

// ModelSliceToProto converts a slice of Budget models to proto Budgets.
func (m *BudgetMapper) ModelSliceToProto(budgets []*models.Budget) []*v1.Budget {
	if budgets == nil {
		return nil
	}

	result := make([]*v1.Budget, len(budgets))
	for i, b := range budgets {
		result[i] = m.ModelToProto(b)
	}
	return result
}

// ModelItemToProto converts a BudgetItem domain model to proto BudgetItem type.
func (m *BudgetMapper) ModelItemToProto(item *models.BudgetItem) *v1.BudgetItem {
	if item == nil {
		return nil
	}

	// Use budget item's currency field, fallback to VND if not set
	currency := item.Currency
	if currency == "" {
		currency = types.VND
	}

	return &v1.BudgetItem{
		Id:        item.ID,
		BudgetId:  item.BudgetID,
		Name:      item.Name,
		Total: &v1.Money{
			Amount:   item.Total,
			Currency: currency,
		},
		Checked:   item.Checked,
		CreatedAt: item.CreatedAt.Unix(),
		UpdatedAt: item.UpdatedAt.Unix(),
		Currency:  currency,
	}
}

// ModelSliceToProtoItems converts a slice of BudgetItem models to proto BudgetItems.
func (m *BudgetMapper) ModelSliceToProtoItems(items []*models.BudgetItem) []*v1.BudgetItem {
	if items == nil {
		return nil
	}

	result := make([]*v1.BudgetItem, len(items))
	for i, item := range items {
		result[i] = m.ModelItemToProto(item)
	}
	return result
}

// PaginationResultToProto converts service PaginationResult to proto.
func (m *BudgetMapper) PaginationResultToProto(result types.PaginationResult) *v1.PaginationResult {
	return &v1.PaginationResult{
		Page:       int32(result.Page),
		PageSize:   int32(result.PageSize),
		TotalCount: int32(result.TotalCount),
		TotalPages: int32(result.TotalPages),
	}
}

// InvestmentMapper handles conversion between investment domain models and proto types.
type InvestmentMapper struct{}

// NewInvestmentMapper creates a new InvestmentMapper.
func NewInvestmentMapper() *InvestmentMapper {
	return &InvestmentMapper{}
}

// ModelToProto converts an Investment domain model to proto Investment type.
func (m *InvestmentMapper) ModelToProto(investment *models.Investment) *v1.Investment {
	if investment == nil {
		return nil
	}

	return &v1.Investment{
		Id:                   investment.ID,
		UserId:               investment.UserID,
		WalletId:             models.DerefInt32(investment.WalletID),
		Symbol:               investment.Symbol,
		Name:                 investment.Name,
		Type:                 v1.InvestmentType(investment.Type),
		Quantity:             investment.Quantity,
		AverageCost:          investment.AverageCost,
		TotalCost:            investment.TotalCost,
		Currency:             investment.Currency,
		CurrentPrice:         investment.CurrentPrice,
		CurrentValue:         investment.CurrentValue,
		UnrealizedPnl:        investment.UnrealizedPNL,
		UnrealizedPnlPercent: investment.UnrealizedPNLPercent,
		RealizedPnl:          investment.RealizedPNL,
		TotalDividends:       investment.TotalDividends,
		PurchaseUnit:         investment.PurchaseUnit,
		IsCustom:             investment.IsCustom,
		CreatedAt:            investment.CreatedAt.Unix(),
		UpdatedAt:            investment.UpdatedAt.Unix(),
	}
}

// ModelSliceToProto converts a slice of Investment models to proto Investments.
func (m *InvestmentMapper) ModelSliceToProto(investments []*models.Investment) []*v1.Investment {
	if investments == nil {
		return nil
	}

	result := make([]*v1.Investment, len(investments))
	for i, inv := range investments {
		result[i] = m.ModelToProto(inv)
	}
	return result
}

// TransactionToProto converts an InvestmentTransaction domain model to proto type.
func (m *InvestmentMapper) TransactionToProto(tx *models.InvestmentTransaction) *v1.InvestmentTransaction {
	if tx == nil {
		return nil
	}

	var lotID int32
	if tx.LotID != nil {
		lotID = *tx.LotID
	}

	return &v1.InvestmentTransaction{
		Id:                tx.ID,
		InvestmentId:      tx.InvestmentID,
		WalletId:          models.DerefInt32(tx.WalletID),
		Type:              v1.InvestmentTransactionType(tx.Type),
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

// TransactionSliceToProto converts a slice of InvestmentTransaction models to proto.
func (m *InvestmentMapper) TransactionSliceToProto(transactions []*models.InvestmentTransaction) []*v1.InvestmentTransaction {
	if transactions == nil {
		return nil
	}

	result := make([]*v1.InvestmentTransaction, len(transactions))
	for i, tx := range transactions {
		result[i] = m.TransactionToProto(tx)
	}
	return result
}

// PaginationResultToProto converts service PaginationResult to proto.
func (m *InvestmentMapper) PaginationResultToProto(result types.PaginationResult) *v1.PaginationResult {
	return &v1.PaginationResult{
		Page:       int32(result.Page),
		PageSize:   int32(result.PageSize),
		TotalCount: int32(result.TotalCount),
		TotalPages: int32(result.TotalPages),
	}
}
