package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"path/filepath"
	"time"

	"wealthjourney/domain/models"
	"wealthjourney/domain/repository"
	"wealthjourney/pkg/categorization"
	"wealthjourney/pkg/database"
	"wealthjourney/pkg/duplicate"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/fileupload"
	"wealthjourney/pkg/logger"
	"wealthjourney/pkg/metrics"
	"wealthjourney/pkg/parser"
	"wealthjourney/pkg/validator"
	v1 "wealthjourney/protobuf/v1"

	"github.com/google/uuid"
)

// ImportService defines the interface for import business logic.
type ImportService interface {
	// ExecuteImport executes the import of transactions with duplicate handling.
	ExecuteImport(ctx context.Context, userID int32, req *v1.ExecuteImportRequest) (*v1.ExecuteImportResponse, error)

	// DetectDuplicates detects potential duplicates for parsed transactions.
	DetectDuplicates(ctx context.Context, userID int32, req *v1.DetectDuplicatesRequest) (*v1.DetectDuplicatesResponse, error)

	// ConvertCurrency converts imported transactions to wallet currency.
	ConvertCurrency(ctx context.Context, userID int32, req *v1.ConvertCurrencyRequest) (*v1.ConvertCurrencyResponse, error)

	// UndoImport undoes an import within 24 hours of creation.
	UndoImport(ctx context.Context, userID int32, importID string) (*v1.UndoImportResponse, error)

	// GetImportHistory retrieves import history for a user.
	GetImportHistory(ctx context.Context, userID int32, req *v1.GetImportHistoryRequest) (*v1.GetImportHistoryResponse, error)

	// ListBankTemplates retrieves available bank templates.
	ListBankTemplates(ctx context.Context) (*v1.ListBankTemplatesResponse, error)

	// ListExcelSheets lists all sheets in an Excel file.
	ListExcelSheets(ctx context.Context, userID int32, fileID string) (*v1.ListExcelSheetsResponse, error)

	// LearnFromUserCorrections learns from user's category corrections during import.
	LearnFromUserCorrections(ctx context.Context, userID int32, corrections map[string]int32) error

	// User Template Management
	CreateUserTemplate(ctx context.Context, userID int32, req *v1.CreateUserTemplateRequest) (*v1.CreateUserTemplateResponse, error)
	ListUserTemplates(ctx context.Context, userID int32) (*v1.ListUserTemplatesResponse, error)
	GetUserTemplate(ctx context.Context, userID int32, templateID int32) (*v1.GetUserTemplateResponse, error)
	UpdateUserTemplate(ctx context.Context, userID int32, req *v1.UpdateUserTemplateRequest) (*v1.UpdateUserTemplateResponse, error)
	DeleteUserTemplate(ctx context.Context, userID int32, templateID int32) (*v1.DeleteUserTemplateResponse, error)

	// Background Job Management
	GetJobStatus(ctx context.Context, userID int32, jobID string) (*v1.GetJobStatusResponse, error)
	CancelJob(ctx context.Context, userID int32, jobID string) (*v1.CancelJobResponse, error)
	ListUserJobs(ctx context.Context, userID int32, statusFilter v1.JobStatus) (*v1.ListUserJobsResponse, error)

	// File Cleanup
	// CleanupExpiredFiles removes uploaded files older than retention period (1 hour)
	CleanupExpiredFiles(ctx context.Context) (int, error)
}

type importService struct {
	db                *database.Database
	importRepo        repository.ImportRepository
	transactionRepo   repository.TransactionRepository
	walletRepo        repository.WalletRepository
	categoryRepo      repository.CategoryRepository
	duplicateDetector *duplicate.Detector
	categorizer       *categorization.Categorizer
	fxService         ImportFXService // For currency conversion
	jobQueue          ImportJobQueue  // For background processing
}

// FXService defines the interface for exchange rate operations
// ImportFXService defines the minimal FX service interface needed by import service
// This is a subset of the full FXRateService to avoid interface coupling
type ImportFXService interface {
	GetRate(ctx context.Context, fromCurrency, toCurrency string) (float64, error)
	ConvertAmount(ctx context.Context, amount int64, fromCurrency, toCurrency string) (int64, error)
}

// ImportJobQueue defines the interface for background job queue operations
// This interface uses interface{} to avoid import cycles with the jobs package
type ImportJobQueue interface {
	Enqueue(ctx context.Context, job interface{}) error
	GetJob(ctx context.Context, jobID string) (interface{}, error)
	UpdateJob(ctx context.Context, job interface{}) error
	CancelJob(ctx context.Context, jobID string) error
	GetUserJobs(ctx context.Context, userID int32) ([]interface{}, error)
	CleanupExpiredJobs(ctx context.Context) (int, error)
}

// ImportJobData represents the data structure for import jobs
// This is a simplified version to avoid importing the jobs package
type ImportJobData struct {
	JobID          string
	UserID         int32
	FileID         string
	WalletID       int32
	Status         string // Job status as string
	Progress       int32
	ProcessedCount int32
	TotalCount     int32
	Result         *v1.ExecuteImportResponse
	Error          string
	CreatedAt      time.Time
	StartedAt      *time.Time
	CompletedAt    *time.Time
	ExpiresAt      time.Time
}

// NewImportService creates a new ImportService.
func NewImportService(
	db *database.Database,
	importRepo repository.ImportRepository,
	transactionRepo repository.TransactionRepository,
	walletRepo repository.WalletRepository,
	categoryRepo repository.CategoryRepository,
	merchantRepo repository.MerchantRuleRepository,
	keywordRepo repository.KeywordRepository,
	userMappingRepo repository.UserMappingRepository,
	fxService ImportFXService,
	jobQueue ImportJobQueue,
) ImportService {
	// Create categorizer with VN region by default
	categorizer := categorization.NewCategorizer(
		merchantRepo,
		keywordRepo,
		userMappingRepo,
		categoryRepo,
		"VN", // Default region
	)

	return &importService{
		db:                db,
		importRepo:        importRepo,
		transactionRepo:   transactionRepo,
		walletRepo:        walletRepo,
		categoryRepo:      categoryRepo,
		duplicateDetector: duplicate.NewDetector(transactionRepo),
		categorizer:       categorizer,
		fxService:         fxService,
		jobQueue:          jobQueue,
	}
}

// validateImportRequest validates import prerequisites and edge cases.
func (s *importService) validateImportRequest(ctx context.Context, userID int32, req *v1.ExecuteImportRequest) error {
	// Check max transactions per import
	if len(req.Transactions) > 10000 {
		return apperrors.NewValidationError("exceeded maximum transactions per import (10,000)")
	}

	// Validate date range
	now := time.Now()
	tenYearsAgo := now.AddDate(-10, 0, 0)
	oneDayAhead := now.AddDate(0, 0, 1)

	for _, tx := range req.Transactions {
		txDate := time.Unix(tx.Date, 0)

		// Check for future dates
		if txDate.After(oneDayAhead) {
			return apperrors.NewValidationError("transaction date cannot be in the future")
		}

		// Check for dates too old
		if txDate.Before(tenYearsAgo) {
			return apperrors.NewValidationError("transaction date too old (max 10 years)")
		}
	}

	return nil
}

// DetectDuplicates detects potential duplicates for parsed transactions.
func (s *importService) DetectDuplicates(ctx context.Context, userID int32, req *v1.DetectDuplicatesRequest) (*v1.DetectDuplicatesResponse, error) {
	// Track duplicate detection duration
	startTime := time.Now()
	defer func() {
		duration := time.Since(startTime).Seconds()
		metrics.DuplicateDetectionDuration.Observe(duration)
	}()

	// Validate wallet ownership
	_, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
	if err != nil {
		return nil, apperrors.WrapWithUserMessage(err)
	}

	// Detect duplicates using the detector
	duplicateMatches, err := s.duplicateDetector.DetectDuplicates(ctx, req.WalletId, req.Transactions)
	if err != nil {
		return nil, apperrors.WrapWithUserMessage(err)
	}

	// Record duplicate count metric
	metrics.DuplicatesFound.Observe(float64(len(duplicateMatches)))

	// Convert duplicate matches to protobuf format
	pbMatches := make([]*v1.DuplicateMatch, 0, len(duplicateMatches))
	for _, match := range duplicateMatches {
		// Convert existing transaction to protobuf
		existingPb := &v1.Transaction{
			Id:         match.ExistingTransaction.ID,
			WalletId:   match.ExistingTransaction.WalletID,
			CategoryId: 0,
			Amount: &v1.Money{
				Amount:   match.ExistingTransaction.Amount,
				Currency: match.ExistingTransaction.Currency,
			},
			Date: match.ExistingTransaction.Date.Unix(),
			Note: match.ExistingTransaction.Note,
		}

		if match.ExistingTransaction.CategoryID != nil {
			existingPb.CategoryId = *match.ExistingTransaction.CategoryID
		}

		pbMatch := &v1.DuplicateMatch{
			ImportedTransaction:  match.ImportedTransaction,
			ExistingTransaction:  existingPb,
			Confidence:           match.Confidence,
			MatchReason:          match.MatchReason,
		}

		pbMatches = append(pbMatches, pbMatch)
	}

	return &v1.DetectDuplicatesResponse{
		Success:   true,
		Message:   fmt.Sprintf("Found %d potential duplicate(s)", len(pbMatches)),
		Matches:   pbMatches,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// updateTransactionFromParsed updates an existing transaction with data from a parsed transaction
func (s *importService) updateTransactionFromParsed(ctx context.Context, existingTx *models.Transaction, parsedTx *v1.ParsedTransaction, userID int32) {
	existingTx.Amount = parsedTx.Amount.Amount
	existingTx.Date = time.Unix(parsedTx.Date, 0)
	existingTx.Note = parsedTx.Description

	// Update category if provided and valid
	if parsedTx.SuggestedCategoryId > 0 {
		_, err := s.categoryRepo.GetByIDForUser(ctx, parsedTx.SuggestedCategoryId, userID)
		if err == nil {
			existingTx.CategoryID = &parsedTx.SuggestedCategoryId
		}
	}
}

// ExecuteImport executes the import of transactions with duplicate handling.
func (s *importService) ExecuteImport(ctx context.Context, userID int32, req *v1.ExecuteImportRequest) (*v1.ExecuteImportResponse, error) {
	// Track import duration
	startTime := time.Now()
	var fileType = "unknown"
	var importSuccess = false

	defer func() {
		duration := time.Since(startTime).Seconds()
		metrics.ImportDuration.WithLabelValues("execute").Observe(duration)

		// Record transaction count
		if len(req.Transactions) > 0 {
			metrics.ImportTransactionCount.Observe(float64(len(req.Transactions)))
		}

		// Record import attempt
		status := "error"
		if importSuccess {
			status = "success"
		}
		metrics.ImportAttempts.WithLabelValues(status, fileType).Inc()
	}()

	// Validate wallet ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
	if err != nil {
		logger.LogImportError(ctx, userID, "execute:validate_wallet", err, map[string]interface{}{
			"wallet_id": req.WalletId,
			"file_id":   req.FileId,
		})
		return nil, apperrors.WrapWithUserMessage(err)
	}

	// Validate import request prerequisites
	if err := s.validateImportRequest(ctx, userID, req); err != nil {
		logger.LogImportError(ctx, userID, "execute:validate_request", err, map[string]interface{}{
			"wallet_id":         req.WalletId,
			"file_id":           req.FileId,
			"transaction_count": len(req.Transactions),
		})
		return nil, err
	}

	// Check if import should be queued (>500 transactions)
	const largeImportThreshold = 500
	if s.jobQueue != nil && len(req.Transactions) > largeImportThreshold {
		// Create background job using simple data structure
		jobID := uuid.New().String()
		now := time.Now()
		jobData := map[string]interface{}{
			"jobId":      jobID,
			"userId":     userID,
			"fileId":     req.FileId,
			"walletId":   req.WalletId,
			"request":    req,
			"status":     "queued",
			"progress":   int32(0),
			"totalCount": int32(len(req.Transactions)),
			"createdAt":  now,
			"expiresAt":  now.Add(24 * time.Hour),
		}

		// Enqueue job
		if err := s.jobQueue.Enqueue(ctx, jobData); err != nil {
			logger.LogImportError(ctx, userID, "execute:enqueue_job", err, map[string]interface{}{
				"job_id":            jobID,
				"wallet_id":         req.WalletId,
				"file_id":           req.FileId,
				"transaction_count": len(req.Transactions),
			})
			return nil, fmt.Errorf("failed to queue import job: %w", err)
		}

		logger.LogImportSuccess(ctx, userID, "execute:job_queued", map[string]interface{}{
			"job_id":            jobID,
			"wallet_id":         req.WalletId,
			"transaction_count": len(req.Transactions),
		})

		// Return immediate response with job ID
		return &v1.ExecuteImportResponse{
			Success:       true,
			Message:       fmt.Sprintf("Import queued for background processing (%d transactions). Check job status using job ID.", len(req.Transactions)),
			ImportBatchId: jobID, // Use job ID as import batch ID temporarily
			Summary: &v1.ImportSummary{
				TotalImported: 0,
				TotalSkipped:  0,
			},
			Timestamp: time.Now().Format(time.RFC3339),
		}, nil
	}

	// Filter out excluded and invalid transactions
	var validTransactions []*v1.ParsedTransaction
	excludedMap := make(map[int32]bool)
	for _, rowNum := range req.ExcludedRowNumbers {
		excludedMap[rowNum] = true
	}

	for _, tx := range req.Transactions {
		// Skip excluded rows
		if excludedMap[tx.RowNumber] {
			continue
		}
		// Skip invalid transactions
		if !tx.IsValid {
			continue
		}
		validTransactions = append(validTransactions, tx)
	}

	if len(validTransactions) == 0 {
		err := apperrors.NewValidationError("No valid transactions to import")
		logger.LogImportError(ctx, userID, "execute:no_valid_transactions", err, map[string]interface{}{
			"wallet_id":       req.WalletId,
			"file_id":         req.FileId,
			"total_rows":      len(req.Transactions),
			"excluded_count":  len(req.ExcludedRowNumbers),
		})
		return nil, err
	}

	// Detect duplicates if strategy is AUTO_MERGE, SKIP_ALL, or REVIEW_EACH
	var duplicateMatches []*duplicate.DuplicateMatch
	duplicateMatchMap := make(map[int32]int32) // parsedTx row number -> existing tx ID
	if req.Strategy == v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_AUTO_MERGE ||
		req.Strategy == v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_SKIP_ALL ||
		req.Strategy == v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH {
		duplicateMatches, err = s.duplicateDetector.DetectDuplicates(ctx, req.WalletId, validTransactions)
		if err != nil {
			logger.LogImportError(ctx, userID, "execute:detect_duplicates", err, map[string]interface{}{
				"wallet_id":         req.WalletId,
				"file_id":           req.FileId,
				"transaction_count": len(validTransactions),
			})
			return nil, err
		}

		// Build map for quick lookup
		for _, match := range duplicateMatches {
			duplicateMatchMap[match.ImportedTransaction.RowNumber] = match.ExistingTransaction.ID
		}
	}

	// Build user action map for REVIEW_EACH strategy
	duplicateActionMap := make(map[int32]*v1.DuplicateAction) // row number -> action
	if req.Strategy == v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH {
		for _, action := range req.DuplicateActions {
			duplicateActionMap[action.ImportedRowNumber] = action
		}
	}

	// Convert parsed transactions to models
	var transactionsToCreate []*models.Transaction
	var transactionsToUpdate []*models.Transaction
	var totalIncome, totalExpenses int64
	var minDate, maxDate time.Time
	var duplicatesMerged, duplicatesSkipped int32

	for _, parsedTx := range validTransactions {
		// Convert Unix timestamp to time.Time
		txDate := time.Unix(parsedTx.Date, 0)

		// Track date range
		if minDate.IsZero() || txDate.Before(minDate) {
			minDate = txDate
		}
		if maxDate.IsZero() || txDate.After(maxDate) {
			maxDate = txDate
		}

		// Check if this transaction is a duplicate
		existingTxID, isDuplicate := duplicateMatchMap[parsedTx.RowNumber]

		// Handle duplicates based on strategy
		if isDuplicate {
			switch req.Strategy {
			case v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_SKIP_ALL:
				// Skip this transaction
				duplicatesSkipped++
				continue

			case v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_AUTO_MERGE:
				// Update the existing transaction
				existingTx, err := s.transactionRepo.GetByID(ctx, existingTxID)
				if err != nil {
					// If we can't get the existing transaction, skip it
					duplicatesSkipped++
					continue
				}

				// Update fields from parsed transaction
				s.updateTransactionFromParsed(ctx, existingTx, parsedTx, userID)

				transactionsToUpdate = append(transactionsToUpdate, existingTx)
				duplicatesMerged++
				continue

			case v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_REVIEW_EACH:
				// Handle user's decision for this duplicate
				action, hasAction := duplicateActionMap[parsedTx.RowNumber]
				if !hasAction {
					// No action specified for this duplicate, skip it
					duplicatesSkipped++
					continue
				}

				// CRITICAL: Validate that the action's transaction ID matches the detected duplicate
				if action.ExistingTransactionId != existingTxID {
					logger.LogImportError(ctx, userID, "execute:duplicate_action_mismatch",
						fmt.Errorf("action transaction ID %d doesn't match duplicate %d",
							action.ExistingTransactionId, existingTxID),
						map[string]interface{}{
							"row_number":   parsedTx.RowNumber,
							"action_tx_id": action.ExistingTransactionId,
							"match_tx_id":  existingTxID,
						})
					duplicatesSkipped++
					continue
				}

				switch action.Action {
				case v1.DuplicateActionType_DUPLICATE_ACTION_MERGE:
					// Update the existing transaction
					existingTx, err := s.transactionRepo.GetByID(ctx, existingTxID)
					if err != nil {
						duplicatesSkipped++
						continue
					}

					// SECURITY: Verify transaction belongs to user's wallet
					if existingTx.WalletID != req.WalletId {
						logger.LogImportError(ctx, userID, "execute:merge_wallet_mismatch",
							fmt.Errorf("transaction %d doesn't belong to wallet %d",
								existingTxID, req.WalletId),
							map[string]interface{}{
								"tx_id":      existingTxID,
								"tx_wallet":  existingTx.WalletID,
								"req_wallet": req.WalletId,
							})
						duplicatesSkipped++
						continue
					}

					// Update fields from parsed transaction
					s.updateTransactionFromParsed(ctx, existingTx, parsedTx, userID)

					transactionsToUpdate = append(transactionsToUpdate, existingTx)
					duplicatesMerged++
					continue

				case v1.DuplicateActionType_DUPLICATE_ACTION_SKIP:
					// User chose to skip this transaction
					duplicatesSkipped++
					continue

				case v1.DuplicateActionType_DUPLICATE_ACTION_KEEP_BOTH:
					// Import as new transaction (fall through to normal flow)
					break

				case v1.DuplicateActionType_DUPLICATE_ACTION_NOT_DUPLICATE:
					// User marked as false positive, import as new transaction (fall through)
					break

				default:
					// Unknown action, skip for safety
					duplicatesSkipped++
					continue
				}

			case v1.DuplicateHandlingStrategy_DUPLICATE_STRATEGY_KEEP_ALL:
				// Import all transactions regardless of duplicates
				// Fall through to create as new transaction
				break
			}
		}

		// Get or create category
		var categoryID *int32
		if parsedTx.SuggestedCategoryId > 0 {
			// Verify category exists and belongs to user
			_, err := s.categoryRepo.GetByIDForUser(ctx, parsedTx.SuggestedCategoryId, userID)
			if err == nil {
				categoryID = &parsedTx.SuggestedCategoryId
			}
		} else if s.categorizer != nil && parsedTx.Description != "" {
			// Try to suggest a category using the categorizer
			suggestion, err := s.categorizer.SuggestCategory(ctx, userID, parsedTx.Description)
			if err == nil && suggestion != nil && suggestion.Confidence >= 70 {
				// Only use suggestions with confidence >= 70%
				// Verify the suggested category exists and belongs to user
				_, err := s.categoryRepo.GetByIDForUser(ctx, suggestion.CategoryID, userID)
				if err == nil {
					categoryID = &suggestion.CategoryID
				}
			}
		}

		// Convert amount from parser format (×10000) to regular storage format (smallest currency unit)
		// Parser stores amounts as ×10000 for precision, but regular transactions store in smallest unit
		// For VND: parser=-990000000 (×10000) → regular=-99000 VND
		// For USD: parser=12345000 (×10000) → regular=12345 cents ($123.45)
		amount := parsedTx.Amount.Amount / 10000

		// Validate amount is not zero
		if amount == 0 {
			logger.LogImportError(ctx, userID, "execute:zero_amount",
				fmt.Errorf("transaction has zero amount"),
				map[string]interface{}{
					"row_number":  parsedTx.RowNumber,
					"description": parsedTx.Description,
					"wallet_id":   req.WalletId,
				})

			// Skip this transaction (don't import zero-amount transactions)
			continue
		}

		// Track income/expenses
		if amount > 0 {
			totalIncome += amount
		} else {
			totalExpenses += -amount // Store as positive for summary
		}

		// Sanitize description
		sanitizedDescription, err := validator.SanitizeDescription(parsedTx.Description)
		if err != nil {
			// If sanitization fails, use empty string
			sanitizedDescription = ""
		}

		transaction := &models.Transaction{
			WalletID:   req.WalletId,
			CategoryID: categoryID,
			Amount:     amount,
			Currency:   parsedTx.Amount.Currency,
			Date:       txDate,
			Note:       sanitizedDescription,
		}

		// Store currency conversion metadata if present
		if parsedTx.OriginalAmount != nil && parsedTx.OriginalAmount.Amount != 0 {
			// Convert original amount from parser format (×10000) to regular format
			originalAmount := parsedTx.OriginalAmount.Amount / 10000
			originalCurrency := parsedTx.OriginalAmount.Currency
			exchangeRate := parsedTx.ExchangeRate
			exchangeRateSource := parsedTx.ExchangeRateSource
			exchangeRateDate := time.Unix(parsedTx.ExchangeRateDate, 0)

			transaction.OriginalAmount = &originalAmount
			transaction.OriginalCurrency = &originalCurrency
			transaction.ExchangeRate = &exchangeRate
			transaction.ExchangeRateDate = &exchangeRateDate
			transaction.ExchangeRateSource = &exchangeRateSource
		}

		transactionsToCreate = append(transactionsToCreate, transaction)
	}

	// Create import batch record
	batchID := uuid.New().String()
	now := time.Now()
	undoExpiresAt := now.Add(24 * time.Hour)

	importBatch := &models.ImportBatch{
		ID:                batchID,
		UserID:            userID,
		WalletID:          req.WalletId,
		FileName:          fmt.Sprintf("import-%s", req.FileId),
		FileType:          "csv",
		ImportedAt:        now,
		TotalRows:         int32(len(req.Transactions)),
		ValidRows:         int32(len(validTransactions)),
		SkippedRows:       int32(len(req.Transactions) - len(validTransactions)),
		DuplicatesMerged:  duplicatesMerged,
		DuplicatesSkipped: duplicatesSkipped,
		TotalIncome:       totalIncome,
		TotalExpenses:     totalExpenses,
		NetChange:         totalIncome - totalExpenses,
		DateRangeStart:    minDate,
		DateRangeEnd:      maxDate,
		CanUndo:           true,
		UndoExpiresAt:     undoExpiresAt,
	}

	// Create import batch
	if err := s.importRepo.CreateImportBatch(ctx, importBatch); err != nil {
		logger.LogImportError(ctx, userID, "execute:create_batch", err, map[string]interface{}{
			"batch_id":  batchID,
			"wallet_id": req.WalletId,
			"file_id":   req.FileId,
		})
		return nil, err
	}

	// Calculate expected balance change (net change from new transactions)
	expectedBalanceChange := totalIncome - totalExpenses

	// Update merged duplicate transactions
	// Note: Merged transactions don't affect wallet balance (they update existing amounts in-place)
	for _, tx := range transactionsToUpdate {
		if err := s.transactionRepo.Update(ctx, tx); err != nil {
			logger.LogImportError(ctx, userID, "execute:update_duplicate", err, map[string]interface{}{
				"batch_id":       batchID,
				"transaction_id": tx.ID,
			})
			return nil, fmt.Errorf("failed to update duplicate transaction: %w", err)
		}
	}

	// Bulk create new transactions atomically
	// BulkCreate automatically updates wallet balance as part of the transaction
	var createdIDs []int32
	if len(transactionsToCreate) > 0 {
		createdIDs, err = s.transactionRepo.BulkCreate(ctx, transactionsToCreate)
		if err != nil {
			logger.LogImportError(ctx, userID, "execute:bulk_create", err, map[string]interface{}{
				"batch_id":          batchID,
				"transaction_count": len(transactionsToCreate),
				"wallet_id":         req.WalletId,
				"expected_change":   expectedBalanceChange,
			})
			return nil, err
		}

		// Link transactions to import batch
		if err := s.importRepo.LinkTransactionsToImport(ctx, batchID, createdIDs); err != nil {
			logger.LogImportError(ctx, userID, "execute:link_transactions", err, map[string]interface{}{
				"batch_id":          batchID,
				"transaction_count": len(createdIDs),
			})
			return nil, err
		}
	}

	// Learn from user's category selections (if they differ from suggestions)
	if s.categorizer != nil {
		corrections := make(map[string]int32)
		for _, parsedTx := range validTransactions {
			// If user manually selected a category that differs from what we suggested
			if parsedTx.SuggestedCategoryId > 0 && parsedTx.CategoryConfidence < 100 {
				corrections[parsedTx.Description] = parsedTx.SuggestedCategoryId
			}
		}
		if len(corrections) > 0 {
			// Learn from corrections asynchronously
			go func() {
				_ = s.LearnFromUserCorrections(context.Background(), userID, corrections)
			}()
		}
	}

	// Get updated wallet balance and verify the update was successful
	walletAfter, err := s.walletRepo.GetByID(ctx, req.WalletId)
	if err != nil {
		logger.LogImportError(ctx, userID, "execute:get_wallet_after", err, map[string]interface{}{
			"wallet_id": req.WalletId,
			"batch_id":  batchID,
		})
		return nil, apperrors.WrapWithUserMessage(err)
	}

	// Verify balance was updated correctly
	// Note: We compare expected change vs actual change from initial balance
	actualBalanceChange := walletAfter.Balance - wallet.Balance
	if actualBalanceChange != expectedBalanceChange {
		err := fmt.Errorf("wallet balance verification failed: expected change %d, actual change %d",
			expectedBalanceChange, actualBalanceChange)
		logger.LogImportError(ctx, userID, "execute:balance_verification_failed", err, map[string]interface{}{
			"wallet_id":              req.WalletId,
			"batch_id":               batchID,
			"balance_before":         wallet.Balance,
			"balance_after":          walletAfter.Balance,
			"expected_change":        expectedBalanceChange,
			"actual_change":          actualBalanceChange,
			"transaction_count":      len(createdIDs),
			"total_income":           totalIncome,
			"total_expenses":         totalExpenses,
		})
		// This is a critical data integrity issue - return error
		return nil, apperrors.NewInternalErrorWithCause("wallet balance update verification failed", err)
	}

	// Use the verified wallet for response
	wallet = walletAfter

	// Mark import as successful
	importSuccess = true

	// Log successful import
	logger.LogImportSuccess(ctx, userID, "execute", map[string]interface{}{
		"batch_id":          batchID,
		"wallet_id":         req.WalletId,
		"file_id":           req.FileId,
		"imported_count":    len(createdIDs),
		"duplicates_merged": duplicatesMerged,
		"duplicates_skip":   duplicatesSkipped,
	})

	// Build response
	return &v1.ExecuteImportResponse{
		Success:       true,
		Message:       fmt.Sprintf("Successfully imported %d transactions", len(createdIDs)),
		ImportBatchId: batchID,
		Summary: &v1.ImportSummary{
			TotalImported:     int32(len(createdIDs)),
			TotalSkipped:      importBatch.SkippedRows,
			DuplicatesMerged:  importBatch.DuplicatesMerged,
			DuplicatesSkipped: importBatch.DuplicatesSkipped,
			TotalIncome: &v1.Money{
				Amount:   totalIncome,
				Currency: wallet.Currency,
			},
			TotalExpenses: &v1.Money{
				Amount:   totalExpenses,
				Currency: wallet.Currency,
			},
			NetChange: &v1.Money{
				Amount:   totalIncome - totalExpenses,
				Currency: wallet.Currency,
			},
			NewWalletBalance: &v1.Money{
				Amount:   wallet.Balance,
				Currency: wallet.Currency,
			},
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UndoImport undoes an import within 24 hours of creation.
func (s *importService) UndoImport(ctx context.Context, userID int32, importID string) (*v1.UndoImportResponse, error) {
	// Get import batch
	batch, err := s.importRepo.GetImportBatchByID(ctx, importID)
	if err != nil {
		return nil, err
	}

	// Verify ownership
	if batch.UserID != userID {
		return nil, apperrors.NewNotFoundError("import batch")
	}

	// Check if undo is allowed
	if !batch.CanUndo {
		return nil, apperrors.NewValidationError("This import cannot be undone")
	}

	// Check if already undone
	if batch.UndoneAt != nil {
		return nil, apperrors.NewValidationError("This import has already been undone")
	}

	// Check if undo window has expired
	if time.Now().After(batch.UndoExpiresAt) {
		return nil, apperrors.NewValidationError("Undo window has expired (24 hours)")
	}

	// Get transactions for this import
	transactions, err := s.importRepo.GetTransactionsByImportBatchID(ctx, importID)
	if err != nil {
		return nil, err
	}

	// Calculate total reversal amount by wallet
	walletReversals := make(map[int32]int64)
	for _, tx := range transactions {
		walletReversals[tx.WalletID] += -tx.Amount
	}

	// BEGIN DATABASE TRANSACTION
	dbTx := s.db.DB.Begin()
	if dbTx.Error != nil {
		logger.LogImportError(ctx, userID, "undo:begin_transaction", dbTx.Error, map[string]interface{}{
			"batch_id": batch.ID,
		})
		return nil, fmt.Errorf("failed to begin transaction: %w", dbTx.Error)
	}

	// Defer rollback in case of panic or early return
	defer func() {
		if r := recover(); r != nil {
			dbTx.Rollback()
			logger.LogImportError(ctx, userID, "undo:panic", fmt.Errorf("panic during undo: %v", r), map[string]interface{}{
				"batch_id": batch.ID,
			})
			panic(r) // Re-panic after rollback
		}
	}()

	// 1. Soft-delete all transactions in batch
	for _, transaction := range transactions {
		if err := s.transactionRepo.DeleteWithTx(ctx, dbTx, transaction.ID); err != nil {
			dbTx.Rollback()
			logger.LogImportError(ctx, userID, "undo:delete_transaction", err, map[string]interface{}{
				"batch_id":       batch.ID,
				"transaction_id": transaction.ID,
			})
			return nil, fmt.Errorf("failed to delete transaction %d: %w", transaction.ID, err)
		}
	}

	// 2. Restore wallet balances
	for walletID, delta := range walletReversals {
		if _, err := s.walletRepo.UpdateBalanceWithTx(ctx, dbTx, walletID, delta); err != nil {
			dbTx.Rollback()
			logger.LogImportError(ctx, userID, "undo:update_balance", err, map[string]interface{}{
				"batch_id":  batch.ID,
				"wallet_id": walletID,
				"delta":     delta,
			})
			return nil, fmt.Errorf("failed to restore wallet %d balance: %w", walletID, err)
		}
	}

	// 3. Mark import batch as undone
	now := time.Now()
	batch.UndoneAt = &now
	batch.CanUndo = false

	if err := s.importRepo.UpdateImportBatchWithTx(ctx, dbTx, batch); err != nil {
		dbTx.Rollback()
		logger.LogImportError(ctx, userID, "undo:update_batch", err, map[string]interface{}{
			"batch_id": batch.ID,
		})
		return nil, fmt.Errorf("failed to mark batch as undone: %w", err)
	}

	// COMMIT DATABASE TRANSACTION
	if err := dbTx.Commit().Error; err != nil {
		logger.LogImportError(ctx, userID, "undo:commit", err, map[string]interface{}{
			"batch_id": batch.ID,
		})
		return nil, fmt.Errorf("failed to commit undo transaction: %w", err)
	}

	// Log successful undo
	logger.LogImportSuccess(ctx, userID, "undo", map[string]interface{}{
		"batch_id":           batch.ID,
		"transactions_count": len(transactions),
	})

	return &v1.UndoImportResponse{
		Success:   true,
		Message:   fmt.Sprintf("Successfully undone import of %d transactions", len(transactions)),
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetImportHistory retrieves import history for a user.
func (s *importService) GetImportHistory(ctx context.Context, userID int32, req *v1.GetImportHistoryRequest) (*v1.GetImportHistoryResponse, error) {
	// Convert pagination params
	opts := repository.ListOptions{
		Limit:   int(req.Pagination.PageSize),
		Offset:  int((req.Pagination.Page - 1) * req.Pagination.PageSize),
		OrderBy: req.Pagination.OrderBy,
		Order:   req.Pagination.Order,
	}

	// Get import batches
	batches, total, err := s.importRepo.ListImportBatchesByUserID(ctx, userID, opts)
	if err != nil {
		return nil, err
	}

	// Convert to protobuf format
	pbBatches := make([]*v1.ImportBatch, 0, len(batches))
	for _, batch := range batches {
		pbBatch := &v1.ImportBatch{
			Id:           batch.ID,
			UserId:       batch.UserID,
			WalletId:     batch.WalletID,
			FileName:     batch.FileName,
			FileType:     batch.FileType,
			BankTemplate: batch.BankTemplate,
			ImportedAt:   batch.ImportedAt.Unix(),
			Summary: &v1.ImportSummary{
				TotalImported:     batch.ValidRows,
				TotalSkipped:      batch.SkippedRows,
				DuplicatesMerged:  batch.DuplicatesMerged,
				DuplicatesSkipped: batch.DuplicatesSkipped,
				TotalIncome: &v1.Money{
					Amount:   batch.TotalIncome,
					Currency: "VND", // Default currency, should get from wallet
				},
				TotalExpenses: &v1.Money{
					Amount:   batch.TotalExpenses,
					Currency: "VND",
				},
				NetChange: &v1.Money{
					Amount:   batch.NetChange,
					Currency: "VND",
				},
			},
			CanUndo:       batch.CanUndo && batch.UndoneAt == nil && time.Now().Before(batch.UndoExpiresAt),
			UndoExpiresAt: batch.UndoExpiresAt.Unix(),
		}
		pbBatches = append(pbBatches, pbBatch)
	}

	// Calculate pagination result
	totalPages := int32(total) / req.Pagination.PageSize
	if int32(total)%req.Pagination.PageSize > 0 {
		totalPages++
	}

	return &v1.GetImportHistoryResponse{
		Success: true,
		Message: fmt.Sprintf("Retrieved %d import batches", len(batches)),
		Batches: pbBatches,
		Pagination: &v1.PaginationResult{
			Page:       req.Pagination.Page,
			PageSize:   req.Pagination.PageSize,
			TotalCount: int32(total),
			TotalPages: totalPages,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListBankTemplates retrieves available bank templates.
func (s *importService) ListBankTemplates(ctx context.Context) (*v1.ListBankTemplatesResponse, error) {
	templates, err := s.importRepo.ListBankTemplates(ctx)
	if err != nil {
		return nil, err
	}

	// Convert to protobuf format
	pbTemplates := make([]*v1.BankTemplate, 0, len(templates))
	for _, template := range templates {
		// Parse file formats from JSON
		var fileFormats []string
		if err := json.Unmarshal(template.FileFormats, &fileFormats); err != nil {
			// Skip template if JSON is invalid
			continue
		}

		pbTemplate := &v1.BankTemplate{
			Id:            template.ID,
			Name:          template.Name,
			BankCode:      template.BankCode,
			StatementType: template.StatementType,
			FileFormats:   fileFormats,
		}
		pbTemplates = append(pbTemplates, pbTemplate)
	}

	return &v1.ListBankTemplatesResponse{
		Success:   true,
		Message:   fmt.Sprintf("Retrieved %d bank templates", len(pbTemplates)),
		Templates: pbTemplates,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ConvertCurrency converts imported transactions to wallet currency using exchange rates
func (s *importService) ConvertCurrency(ctx context.Context, userID int32, req *v1.ConvertCurrencyRequest) (*v1.ConvertCurrencyResponse, error) {
	// Validate wallet ownership
	wallet, err := s.walletRepo.GetByIDForUser(ctx, req.WalletId, userID)
	if err != nil {
		return nil, err
	}

	walletCurrency := wallet.Currency
	if walletCurrency == "" {
		walletCurrency = "VND" // Default
	}

	// Group transactions by currency
	currencyGroups := make(map[string][]*v1.ParsedTransaction)
	for _, tx := range req.Transactions {
		currency := tx.Amount.Currency
		if currency == "" {
			currency = walletCurrency // Use wallet currency if not specified
		}
		currencyGroups[currency] = append(currencyGroups[currency], tx)
	}

	// Process each currency group
	var conversions []*v1.CurrencyConversion
	var convertedTransactions []*v1.ParsedTransaction

	for currency, transactions := range currencyGroups {
		// Skip if same as wallet currency
		if currency == walletCurrency {
			convertedTransactions = append(convertedTransactions, transactions...)
			continue
		}

		// Check for manual rate override
		var exchangeRate float64
		var rateSource string
		var rateDate time.Time

		manualRate, hasManual := req.ManualRates[currency]
		if hasManual && manualRate != nil {
			exchangeRate = manualRate.ExchangeRate
			rateSource = "manual"
			rateDate = time.Unix(manualRate.RateDate, 0)
		} else {
			// Fetch automatic rate (use latest rate for all transactions)
			if s.fxService == nil {
				return nil, apperrors.NewValidationError("currency conversion service not available")
			}

			rate, err := s.fxService.GetRate(ctx, currency, walletCurrency)
			if err != nil {
				return nil, fmt.Errorf("failed to get exchange rate for %s -> %s: %w", currency, walletCurrency, err)
			}
			exchangeRate = rate
			rateSource = "auto"
			rateDate = time.Now()
		}

		// Convert transactions
		var totalOriginal, totalConverted int64
		for _, tx := range transactions {
			originalAmount := tx.Amount.Amount
			originalCurrency := tx.Amount.Currency
			convertedAmount := int64(float64(originalAmount) * exchangeRate)

			totalOriginal += originalAmount
			totalConverted += convertedAmount

			// Create converted transaction with conversion metadata
			convertedTx := &v1.ParsedTransaction{
				RowNumber:           tx.RowNumber,
				Date:                tx.Date,
				Amount:              &v1.Money{Amount: convertedAmount, Currency: walletCurrency},
				Description:         tx.Description,
				OriginalDescription: tx.OriginalDescription,
				Type:                tx.Type,
				SuggestedCategoryId: tx.SuggestedCategoryId,
				CategoryConfidence:  tx.CategoryConfidence,
				ReferenceNumber:     tx.ReferenceNumber,
				ValidationErrors:    tx.ValidationErrors,
				IsValid:             tx.IsValid,
				// Populate conversion metadata
				OriginalAmount:       &v1.Money{Amount: originalAmount, Currency: originalCurrency},
				ExchangeRate:         exchangeRate,
				ExchangeRateSource:   rateSource,
				ExchangeRateDate:     rateDate.Unix(),
			}
			convertedTransactions = append(convertedTransactions, convertedTx)
		}

		// Record conversion info
		conversion := &v1.CurrencyConversion{
			FromCurrency:     currency,
			ToCurrency:       walletCurrency,
			ExchangeRate:     exchangeRate,
			RateSource:       rateSource,
			RateDate:         rateDate.Unix(),
			TransactionCount: int32(len(transactions)),
			TotalOriginal:    &v1.Money{Amount: totalOriginal, Currency: currency},
			TotalConverted:   &v1.Money{Amount: totalConverted, Currency: walletCurrency},
		}
		conversions = append(conversions, conversion)
	}

	return &v1.ConvertCurrencyResponse{
		Success:               true,
		Message:               fmt.Sprintf("Converted %d transaction(s) from %d currency group(s)", len(convertedTransactions), len(conversions)),
		Conversions:           conversions,
		ConvertedTransactions: convertedTransactions,
		Timestamp:             time.Now().Format(time.RFC3339),
	}, nil
}

// ListExcelSheets lists all available sheets in an Excel file.
func (s *importService) ListExcelSheets(ctx context.Context, userID int32, fileID string) (*v1.ListExcelSheetsResponse, error) {
	// Validate file ID
	if fileID == "" {
		return nil, apperrors.NewValidationError("fileId is required")
	}

	// Get file path from upload directory
	matches, err := filepath.Glob(filepath.Join(fileupload.UploadDir, fileID+".*"))
	if err != nil || len(matches) == 0 {
		return nil, apperrors.NewNotFoundError("uploaded file not found")
	}
	filePath := matches[0]
	fileExt := filepath.Ext(filePath)

	// Validate it's an Excel file
	if fileExt != ".xlsx" && fileExt != ".xls" {
		return nil, apperrors.NewValidationError("file is not an Excel file (.xlsx or .xls)")
	}

	// Create Excel parser
	excelParser := parser.NewExcelParser(filePath, nil)
	defer excelParser.Close()

	// List all visible sheets
	sheets, err := excelParser.ListSheets()
	if err != nil {
		return nil, fmt.Errorf("failed to list sheets: %w", err)
	}

	if len(sheets) == 0 {
		return nil, apperrors.NewValidationError("no visible sheets found in Excel file")
	}

	// Auto-detect best sheet
	defaultSheet, err := excelParser.DetectDataSheet()
	if err != nil {
		// If detection fails, use first sheet
		if len(sheets) > 0 {
			defaultSheet = sheets[0]
		} else {
			return nil, apperrors.NewValidationError("no sheets available for detection")
		}
	}

	return &v1.ListExcelSheetsResponse{
		Success:      true,
		Message:      fmt.Sprintf("Found %d sheet(s) in Excel file", len(sheets)),
		SheetNames:   sheets,
		DefaultSheet: defaultSheet,
		Timestamp:    time.Now().Format(time.RFC3339),
	}, nil
}

// LearnFromUserCorrections learns from user's category corrections during import.
// The corrections map contains description -> categoryID mappings that the user manually selected.
func (s *importService) LearnFromUserCorrections(ctx context.Context, userID int32, corrections map[string]int32) error {
	if s.categorizer == nil {
		return nil // Categorizer not initialized, skip learning
	}

	for description, categoryID := range corrections {
		if err := s.categorizer.LearnFromCorrection(ctx, userID, description, categoryID); err != nil {
			// Log error but continue with other corrections
			fmt.Printf("Warning: Failed to learn correction for '%s': %v\n", description, err)
		}
	}

	return nil
}

// CreateUserTemplate creates a new user template
func (s *importService) CreateUserTemplate(ctx context.Context, userID int32, req *v1.CreateUserTemplateRequest) (*v1.CreateUserTemplateResponse, error) {
	// Validate request
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if req.TemplateName == "" {
		return nil, apperrors.NewValidationError("template name is required")
	}

	if req.ColumnMapping == nil {
		return nil, apperrors.NewValidationError("column mapping is required")
	}

	if req.DateFormat == "" {
		return nil, apperrors.NewValidationError("date format is required")
	}

	if req.Currency == "" {
		return nil, apperrors.NewValidationError("currency is required")
	}

	// Serialize column mapping to JSON
	mappingJSON, err := json.Marshal(req.ColumnMapping)
	if err != nil {
		return nil, apperrors.NewValidationError(fmt.Sprintf("invalid column mapping: %v", err))
	}

	// Serialize file formats to JSON
	fileFormatsJSON, err := json.Marshal(req.FileFormats)
	if err != nil {
		return nil, apperrors.NewValidationError(fmt.Sprintf("invalid file formats: %v", err))
	}

	// Create default amount format (matches bank template structure)
	amountFormat := map[string]interface{}{
		"thousandsSeparator": ",",
		"decimalSeparator":   ".",
		"negativeFormat":     "minus", // or "parentheses"
	}
	amountFormatJSON, _ := json.Marshal(amountFormat)

	// Create user template
	template := &models.UserTemplate{
		UserID:        userID,
		Name:          req.TemplateName,
		ColumnMapping: mappingJSON,
		DateFormat:    req.DateFormat,
		Currency:      req.Currency,
		AmountFormat:  amountFormatJSON,
		FileFormats:   fileFormatsJSON,
	}

	if err := s.importRepo.CreateUserTemplate(ctx, template); err != nil {
		return nil, err
	}

	// Convert to protobuf response
	pbTemplate, err := s.userTemplateToProto(template)
	if err != nil {
		return nil, err
	}

	return &v1.CreateUserTemplateResponse{
		Success:   true,
		Message:   "Template created successfully",
		Template:  pbTemplate,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListUserTemplates lists all user templates for a user
func (s *importService) ListUserTemplates(ctx context.Context, userID int32) (*v1.ListUserTemplatesResponse, error) {
	// Validate user ID
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get templates from repository
	templates, err := s.importRepo.ListUserTemplatesByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	// Convert to protobuf format
	var pbTemplates []*v1.UserTemplate
	for _, template := range templates {
		pbTemplate, err := s.userTemplateToProto(template)
		if err != nil {
			// Log error and skip this template
			logger.LogImportError(ctx, userID, "list_templates:convert", err, map[string]interface{}{
				"template_id": template.ID,
			})
			continue
		}
		pbTemplates = append(pbTemplates, pbTemplate)
	}

	return &v1.ListUserTemplatesResponse{
		Success:   true,
		Message:   fmt.Sprintf("Found %d template(s)", len(pbTemplates)),
		Templates: pbTemplates,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// GetUserTemplate retrieves a specific user template
func (s *importService) GetUserTemplate(ctx context.Context, userID int32, templateID int32) (*v1.GetUserTemplateResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if err := validator.ID(templateID); err != nil {
		return nil, apperrors.NewValidationError("invalid template ID")
	}

	// Get template from repository
	template, err := s.importRepo.GetUserTemplateByID(ctx, templateID, userID)
	if err != nil {
		return nil, err
	}

	// Convert to protobuf format
	pbTemplate, err := s.userTemplateToProto(template)
	if err != nil {
		return nil, err
	}

	return &v1.GetUserTemplateResponse{
		Success:   true,
		Message:   "Template retrieved successfully",
		Template:  pbTemplate,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// UpdateUserTemplate updates an existing user template
func (s *importService) UpdateUserTemplate(ctx context.Context, userID int32, req *v1.UpdateUserTemplateRequest) (*v1.UpdateUserTemplateResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if err := validator.ID(req.TemplateId); err != nil {
		return nil, apperrors.NewValidationError("invalid template ID")
	}

	// Get existing template to verify ownership
	existingTemplate, err := s.importRepo.GetUserTemplateByID(ctx, req.TemplateId, userID)
	if err != nil {
		return nil, err
	}

	// Validate request fields
	if req.TemplateName == "" {
		return nil, apperrors.NewValidationError("template name is required")
	}

	if req.ColumnMapping == nil {
		return nil, apperrors.NewValidationError("column mapping is required")
	}

	if req.DateFormat == "" {
		return nil, apperrors.NewValidationError("date format is required")
	}

	if req.Currency == "" {
		return nil, apperrors.NewValidationError("currency is required")
	}

	// Serialize column mapping to JSON
	mappingJSON, err := json.Marshal(req.ColumnMapping)
	if err != nil {
		return nil, apperrors.NewValidationError(fmt.Sprintf("invalid column mapping: %v", err))
	}

	// Serialize file formats to JSON
	fileFormatsJSON, err := json.Marshal(req.FileFormats)
	if err != nil {
		return nil, apperrors.NewValidationError(fmt.Sprintf("invalid file formats: %v", err))
	}

	// Update template fields
	existingTemplate.Name = req.TemplateName
	existingTemplate.ColumnMapping = mappingJSON
	existingTemplate.DateFormat = req.DateFormat
	existingTemplate.Currency = req.Currency
	existingTemplate.FileFormats = fileFormatsJSON

	// Save to database
	if err := s.importRepo.UpdateUserTemplate(ctx, existingTemplate); err != nil {
		return nil, err
	}

	// Convert to protobuf response
	pbTemplate, err := s.userTemplateToProto(existingTemplate)
	if err != nil {
		return nil, err
	}

	return &v1.UpdateUserTemplateResponse{
		Success:   true,
		Message:   "Template updated successfully",
		Template:  pbTemplate,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// DeleteUserTemplate deletes a user template
func (s *importService) DeleteUserTemplate(ctx context.Context, userID int32, templateID int32) (*v1.DeleteUserTemplateResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if err := validator.ID(templateID); err != nil {
		return nil, apperrors.NewValidationError("invalid template ID")
	}

	// Delete template
	if err := s.importRepo.DeleteUserTemplate(ctx, templateID, userID); err != nil {
		return nil, err
	}

	return &v1.DeleteUserTemplateResponse{
		Success:   true,
		Message:   "Template deleted successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// userTemplateToProto converts a models.UserTemplate to protobuf UserTemplate
func (s *importService) userTemplateToProto(template *models.UserTemplate) (*v1.UserTemplate, error) {
	// Deserialize column mapping
	var columnMapping v1.ColumnMapping
	if err := json.Unmarshal(template.ColumnMapping, &columnMapping); err != nil {
		return nil, apperrors.NewValidationError(fmt.Sprintf("invalid column mapping format: %v", err))
	}

	// Deserialize file formats
	var fileFormats []string
	if len(template.FileFormats) > 0 {
		if err := json.Unmarshal(template.FileFormats, &fileFormats); err != nil {
			// Set default if unmarshal fails
			fileFormats = []string{"csv"}
		}
	} else {
		fileFormats = []string{"csv"}
	}

	return &v1.UserTemplate{
		Id:            template.ID,
		UserId:        template.UserID,
		Name:          template.Name,
		ColumnMapping: &columnMapping,
		DateFormat:    template.DateFormat,
		Currency:      template.Currency,
		FileFormats:   fileFormats,
		CreatedAt:     template.CreatedAt.Unix(),
		UpdatedAt:     template.UpdatedAt.Unix(),
	}, nil
}

// GetJobStatus retrieves the status of a background import job
func (s *importService) GetJobStatus(ctx context.Context, userID int32, jobID string) (*v1.GetJobStatusResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if jobID == "" {
		return nil, apperrors.NewValidationError("job ID is required")
	}

	// Get job from queue
	jobInterface, err := s.jobQueue.GetJob(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	if jobInterface == nil {
		return nil, apperrors.NewNotFoundError("job")
	}

	// Type assert to ImportJobData
	job, ok := jobInterface.(*ImportJobData)
	if !ok {
		return nil, fmt.Errorf("invalid job data type")
	}

	// Verify ownership
	if job.UserID != userID {
		return nil, apperrors.NewNotFoundError("job")
	}

	// Convert to protobuf format
	pbJob := s.jobToProto(job)

	return &v1.GetJobStatusResponse{
		Success:   true,
		Message:   fmt.Sprintf("Job status: %s", job.Status),
		Job:       pbJob,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// CancelJob cancels a background import job
func (s *importService) CancelJob(ctx context.Context, userID int32, jobID string) (*v1.CancelJobResponse, error) {
	// Validate inputs
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	if jobID == "" {
		return nil, apperrors.NewValidationError("job ID is required")
	}

	// Get job to verify ownership
	jobData, err := s.jobQueue.GetJob(ctx, jobID)
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}

	if jobData == nil {
		return nil, apperrors.NewNotFoundError("job")
	}

	// Type assert to ImportJobData
	job, ok := jobData.(*ImportJobData)
	if !ok {
		return nil, fmt.Errorf("invalid job data type")
	}

	// Verify ownership
	if job.UserID != userID {
		return nil, apperrors.NewNotFoundError("job")
	}

	// Cancel job
	if err := s.jobQueue.CancelJob(ctx, jobID); err != nil {
		return nil, err
	}

	return &v1.CancelJobResponse{
		Success:   true,
		Message:   "Job cancelled successfully",
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// ListUserJobs retrieves all jobs for a user
func (s *importService) ListUserJobs(ctx context.Context, userID int32, statusFilter v1.JobStatus) (*v1.ListUserJobsResponse, error) {
	// Validate user ID
	if err := validator.ID(userID); err != nil {
		return nil, err
	}

	// Get all jobs for user
	jobList, err := s.jobQueue.GetUserJobs(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user jobs: %w", err)
	}

	// Filter by status if specified
	var filteredJobs []*ImportJobData
	for _, jobData := range jobList {
		// Type assert to ImportJobData
		job, ok := jobData.(*ImportJobData)
		if !ok {
			log.Printf("Warning: Skipping invalid job data type in user jobs list")
			continue
		}

		// Apply status filter
		if statusFilter != v1.JobStatus_JOB_STATUS_UNSPECIFIED {
			jobStatus := s.mapJobStatusToProto(job.Status)
			if jobStatus != statusFilter {
				continue
			}
		}
		filteredJobs = append(filteredJobs, job)
	}

	// Convert to protobuf format
	pbJobs := make([]*v1.ImportJobStatus, 0, len(filteredJobs))
	for _, job := range filteredJobs {
		pbJobs = append(pbJobs, s.jobToProto(job))
	}

	return &v1.ListUserJobsResponse{
		Success:   true,
		Message:   fmt.Sprintf("Found %d job(s)", len(pbJobs)),
		Jobs:      pbJobs,
		Timestamp: time.Now().Format(time.RFC3339),
	}, nil
}

// jobToProto converts an ImportJobData to protobuf ImportJobStatus
func (s *importService) jobToProto(job *ImportJobData) *v1.ImportJobStatus {
	pbJob := &v1.ImportJobStatus{
		JobId:          job.JobID,
		UserId:         job.UserID,
		FileId:         job.FileID,
		WalletId:       job.WalletID,
		Status:         s.mapJobStatusToProto(job.Status),
		Progress:       job.Progress,
		ProcessedCount: job.ProcessedCount,
		TotalCount:     job.TotalCount,
		Result:         job.Result,
		Error:          job.Error,
		CreatedAt:      job.CreatedAt.Unix(),
		ExpiresAt:      job.ExpiresAt.Unix(),
	}

	if job.StartedAt != nil {
		pbJob.StartedAt = job.StartedAt.Unix()
	}

	if job.CompletedAt != nil {
		pbJob.CompletedAt = job.CompletedAt.Unix()
	}

	return pbJob
}

// mapJobStatusToProto converts string job status to protobuf JobStatus
func (s *importService) mapJobStatusToProto(status string) v1.JobStatus {
	switch status {
	case "queued":
		return v1.JobStatus_JOB_STATUS_QUEUED
	case "processing":
		return v1.JobStatus_JOB_STATUS_PROCESSING
	case "completed":
		return v1.JobStatus_JOB_STATUS_COMPLETED
	case "failed":
		return v1.JobStatus_JOB_STATUS_FAILED
	case "cancelled":
		return v1.JobStatus_JOB_STATUS_CANCELLED
	default:
		return v1.JobStatus_JOB_STATUS_UNSPECIFIED
	}
}

// CleanupExpiredFiles removes uploaded files older than retention period (1 hour)
func (s *importService) CleanupExpiredFiles(ctx context.Context) (int, error) {
	const FileRetentionHours = 1 // As per Section 13.1 requirements
	cutoffTime := time.Now().Add(-FileRetentionHours * time.Hour)

	// Use upload directory from fileupload package
	uploadDir := fileupload.UploadDir

	files, err := fileupload.ListFiles(uploadDir)
	if err != nil {
		log.Printf("[FILE_CLEANUP_ERROR] operation=list_files upload_dir=%s error=%v", uploadDir, err)
		return 0, fmt.Errorf("failed to list files: %w", err)
	}

	var deletedCount int
	var errors []error

	for _, file := range files {
		// Skip files modified within retention period
		if file.ModTime.ModTime().After(cutoffTime) {
			continue
		}

		// Delete expired file
		if err := fileupload.DeleteFile(file.Path); err != nil {
			log.Printf("[FILE_CLEANUP_ERROR] operation=delete_file file_path=%s file_age=%s error=%v",
				file.Path, time.Since(file.ModTime.ModTime()).String(), err)
			errors = append(errors, fmt.Errorf("failed to delete %s: %w", file.Path, err))
			continue
		}

		deletedCount++
		log.Printf("[FILE_CLEANUP_SUCCESS] operation=file_deleted file_path=%s file_age=%s",
			file.Path, time.Since(file.ModTime.ModTime()).String())
	}

	// Log summary
	log.Printf("[FILE_CLEANUP_SUMMARY] deleted_count=%d error_count=%d total_files=%d",
		deletedCount, len(errors), len(files))

	// Return success even if some files failed to delete
	return deletedCount, nil
}
