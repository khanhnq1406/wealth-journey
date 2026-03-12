package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wealthjourney/domain/repository"
	"wealthjourney/domain/service"
	"wealthjourney/pkg/device"
	apperrors "wealthjourney/pkg/errors"
	"wealthjourney/pkg/fileupload"
	"wealthjourney/pkg/handler"
	"wealthjourney/pkg/logger"
	"wealthjourney/pkg/metrics"
	"wealthjourney/pkg/parser"
	v1 "wealthjourney/protobuf/v1"
)

// ImportHandler handles import-related HTTP requests.
type ImportHandler struct {
	importRepo    repository.ImportRepository
	importService service.ImportService
}

// NewImportHandler creates a new ImportHandler instance.
func NewImportHandler(importRepo repository.ImportRepository, importService service.ImportService) *ImportHandler {
	return &ImportHandler{
		importRepo:    importRepo,
		importService: importService,
	}
}

// ListBankTemplates retrieves all available bank templates.
// @Summary List bank templates
// @Tags import
// @Produce json
// @Success 200 {object} v1.ListBankTemplatesResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/templates [get]
func (h *ImportHandler) ListBankTemplates(c *gin.Context) {
	response, err := h.importService.ListBankTemplates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Failed to fetch bank templates",
			"error":   err.Error(),
		})
		return
	}

	handler.Success(c, response)
}

// UploadFile handles bank statement file upload.
// @Summary Upload bank statement file
// @Tags import
// @Accept json
// @Produce json
// @Param request body v1.UploadStatementFileRequest true "Upload file request"
// @Success 200 {object} v1.UploadStatementFileResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/upload [post]
func (h *ImportHandler) UploadFile(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}
	_ = userID // Will be used for user-specific upload directory in future

	// Bind and validate request
	var req v1.UploadStatementFileRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}


	// Validate required fields
	if len(req.FileData) == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("file is required"))
		return
	}

	if req.FileName == "" {
		handler.BadRequest(c, apperrors.NewValidationError("fileName is required"))
		return
	}

	// Sanitize filename
	sanitizedName, err := fileupload.SanitizeFileName(req.FileName)
	if err != nil {
		logger.LogImportError(c.Request.Context(), userID, "upload:sanitize_filename", err, map[string]interface{}{
			"original_filename": req.FileName,
			"file_size":         req.FileSize,
		})
		handler.BadRequest(c, apperrors.WrapWithUserMessage(err))
		return
	}

	// Validate file type
	fileType, err := fileupload.ValidateFileType(sanitizedName)
	if err != nil {
		handler.BadRequest(c, apperrors.NewValidationError(err.Error()))
		return
	}

	// Validate actual file data size matches declared size
	if err := fileupload.ValidateFileSizeMatch(req.FileSize, req.FileData); err != nil {
		logger.LogImportError(c.Request.Context(), userID, "upload:size_mismatch", err, map[string]interface{}{
			"filename":       sanitizedName,
			"declared_size":  req.FileSize,
			"actual_size":    len(req.FileData),
		})
		handler.BadRequest(c, apperrors.NewValidationError(err.Error()))
		return
	}

	// Validate file size limits
	if err := fileupload.ValidateFileSize(req.FileSize, fileType); err != nil {
		logger.LogImportError(c.Request.Context(), userID, "upload:size_limit", err, map[string]interface{}{
			"filename":  sanitizedName,
			"file_size": req.FileSize,
			"file_type": string(fileType),
		})
		handler.BadRequest(c, apperrors.NewValidationError(err.Error()))
		return
	}

	// Validate file content (MIME type and security)
	if err := fileupload.ValidateFileContent(req.FileData, sanitizedName); err != nil {
		logger.LogImportError(c.Request.Context(), userID, "upload:validate_content", err, map[string]interface{}{
			"filename":  sanitizedName,
			"file_size": req.FileSize,
		})
		handler.BadRequest(c, apperrors.WrapWithUserMessage(err))
		return
	}

	// Record file upload size metric
	metrics.FileUploadSize.WithLabelValues(string(fileType)).Observe(float64(req.FileSize))

	// Extract IP address and user agent for audit logging
	ipAddress := device.GetClientIP(c)
	userAgent := c.GetHeader("User-Agent")

	// Upload file from bytes
	result, err := fileupload.UploadFileFromBytes(req.FileData, sanitizedName, req.FileSize)
	if err != nil {
		logger.LogImportError(c.Request.Context(), userID, "upload:save_file", err, map[string]interface{}{
			"filename":  sanitizedName,
			"file_size": req.FileSize,
			"file_type": string(fileType),
		})

		// Audit log: Failed upload
		logger.LogImportAudit(c.Request.Context(), logger.NewUploadAuditLog(
			userID,
			"", // No file ID yet
			sanitizedName,
			string(fileType),
			ipAddress,
			userAgent,
			false,
			err.Error(),
		))

		// Wrap error with user-friendly message
		handler.BadRequest(c, apperrors.WrapWithUserMessage(err))
		return
	}

	// Log success (legacy format - kept for backwards compatibility)
	logger.LogImportSuccess(c.Request.Context(), userID, "upload", map[string]interface{}{
		"file_id":   result.FileID,
		"file_type": string(fileType),
		"file_size": req.FileSize,
	})

	// Audit log: Successful upload
	logger.LogImportAudit(c.Request.Context(), logger.NewUploadAuditLog(
		userID,
		result.FileID,
		sanitizedName,
		string(fileType),
		ipAddress,
		userAgent,
		true,
		"",
	))

	// Build response
	response := &v1.UploadStatementFileResponse{
		Success:   true,
		Message:   "File uploaded successfully",
		FileId:    result.FileID,
		Timestamp: time.Now().Format(time.RFC3339),
	}

	handler.Success(c, response)
}

// ParseFile parses an uploaded bank statement file.
// @Summary Parse bank statement file
// @Tags import
// @Accept json
// @Produce json
// @Param request body v1.ParseStatementRequest true "Parse request"
// @Success 200 {object} v1.ParseStatementResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/parse [post]
func (h *ImportHandler) ParseFile(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}
	_ = userID // Will be used for permission checks in future

	// Bind and validate request
	var req v1.ParseStatementRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate required fields
	if req.FileId == "" {
		handler.BadRequest(c, apperrors.NewValidationError("fileId is required"))
		return
	}

	fmt.Printf("[DEBUG] ParseFile: Received parse request for fileId: %s\n", req.FileId)

	// Get file URL from storage (works with both Supabase and local storage)
	fileURL, fileExt, err := fileupload.GetFileURL(c.Request.Context(), req.FileId)
	if err != nil {
		fmt.Printf("[DEBUG] ParseFile: GetFileURL failed: %v\n", err)
		handler.BadRequest(c, apperrors.NewValidationError("uploaded file not found"))
		return
	}

	fmt.Printf("[DEBUG] ParseFile: Got fileURL=%s, fileExt=%s\n", fileURL, fileExt)

	// Get bank template or custom mapping
	var columnMapping *parser.ColumnMapping

	if req.BankTemplateId != "" {
		// Load bank template from repository
		template, err := h.importRepo.GetBankTemplateByID(c.Request.Context(), req.BankTemplateId)
		if err != nil {
			handler.BadRequest(c, apperrors.NewValidationError(fmt.Sprintf("invalid bank template: %s", req.BankTemplateId)))
			return
		}

		// Parse column mapping from JSON
		var mapping struct {
			DateColumn        int `json:"dateColumn"`
			AmountColumn      int `json:"amountColumn"`
			DescriptionColumn int `json:"descriptionColumn"`
			TypeColumn        int `json:"typeColumn"`
			CategoryColumn    int `json:"categoryColumn"`
			ReferenceColumn   int `json:"referenceColumn"`
		}

		if err := json.Unmarshal(template.ColumnMapping, &mapping); err != nil {
			handler.BadRequest(c, apperrors.NewValidationError(fmt.Sprintf("invalid column mapping in template: %v", err)))
			return
		}

		// Convert template to column mapping
		columnMapping = &parser.ColumnMapping{
			DateColumn:        mapping.DateColumn,
			AmountColumn:      mapping.AmountColumn,
			DebitColumn:       -1, // Will be auto-detected if needed
			CreditColumn:      -1, // Will be auto-detected if needed
			DescriptionColumn: mapping.DescriptionColumn,
			TypeColumn:        mapping.TypeColumn - 1,    // -1 if not present (0 index becomes -1)
			CategoryColumn:    mapping.CategoryColumn - 1,
			ReferenceColumn:   mapping.ReferenceColumn - 1,
			DateFormat:        template.DateFormat,
			Currency:          template.Currency,
		}
	} else if req.CustomMapping != nil {
		// Use custom mapping (convert string column names to indices if needed)
		// For now, assume custom mapping provides numeric indices as strings
		dateCol, _ := strconv.Atoi(req.CustomMapping.DateColumn)
		amountCol, _ := strconv.Atoi(req.CustomMapping.AmountColumn)
		descCol, _ := strconv.Atoi(req.CustomMapping.DescriptionColumn)
		typeCol, _ := strconv.Atoi(req.CustomMapping.TypeColumn)
		catCol, _ := strconv.Atoi(req.CustomMapping.CategoryColumn)
		refCol, _ := strconv.Atoi(req.CustomMapping.ReferenceColumn)

		columnMapping = &parser.ColumnMapping{
			DateColumn:        dateCol,
			AmountColumn:      amountCol,
			DebitColumn:       -1, // Will be auto-detected if needed
			CreditColumn:      -1, // Will be auto-detected if needed
			DescriptionColumn: descCol,
			TypeColumn:        typeCol - 1,    // -1 if not present
			CategoryColumn:    catCol - 1,
			ReferenceColumn:   refCol - 1,
			DateFormat:        req.CustomMapping.DateFormat,
			Currency:          req.CustomMapping.Currency,
		}
	}

	// Validate column mapping requirement based on file type
	// CSV files require explicit mapping, but PDF/Excel can use auto-detection
	if columnMapping == nil && fileExt != ".pdf" && fileExt != ".xlsx" && fileExt != ".xls" {
		handler.BadRequest(c, apperrors.NewValidationError("column mapping is required for CSV files. Please select a bank template or provide custom mapping"))
		return
	}

	// Extract IP address and user agent for audit logging
	ipAddress := device.GetClientIP(c)
	userAgent := c.GetHeader("User-Agent")

	// Parse file based on extension
	var parsedRows []*parser.ParsedRow

	// Track parsing duration
	parseStart := time.Now()
	fileTypeStr := "csv"

	switch fileExt {
	case ".pdf":
		fileTypeStr = "pdf"
		// PDF parser supports auto-detection when columnMapping is nil
		// It will attempt to detect columns from header row and extract currency
		pdfParser := parser.NewPDFParser(fileURL, columnMapping)
		parsedRows, err = pdfParser.Parse()
		if err != nil {
			metrics.ImportAttempts.WithLabelValues("error", fileTypeStr).Inc()
			logger.LogImportError(c.Request.Context(), userID, "parse:pdf", err, logger.ImportErrorMetadata(
				req.FileId, fileTypeStr, 0, 0,
			))

			// Audit log: Failed parse
			logger.LogImportAudit(c.Request.Context(), logger.NewParseAuditLog(
				userID,
				req.FileId,
				fileTypeStr,
				ipAddress,
				userAgent,
				0,
				false,
				err.Error(),
			))

			handler.BadRequest(c, apperrors.WrapWithUserMessage(err))
			return
		}
		// Get the detected mapping (includes extracted currency from file metadata)
		if columnMapping == nil {
			columnMapping = pdfParser.GetDetectedMapping()
		}
	case ".xlsx", ".xls":
		fileTypeStr = "excel"
		// Use Excel parser with auto-detection (ignore template mapping for Excel files)
		// Excel files have too much variation in layout to use fixed column mappings
		excelParser := parser.NewExcelParser(fileURL, nil)
		defer excelParser.Close() // Clean up: close the Excel file

		// Set specific sheet if provided
		if req.SheetName != "" {
			excelParser.SetSheet(req.SheetName)
		}

		parsedRows, err = excelParser.Parse()
		if err != nil {
			metrics.ImportAttempts.WithLabelValues("error", fileTypeStr).Inc()
			logger.LogImportError(c.Request.Context(), userID, "parse:excel", err, logger.ImportErrorMetadata(
				req.FileId, fileTypeStr, 0, 0,
			))

			// Audit log: Failed parse
			logger.LogImportAudit(c.Request.Context(), logger.NewParseAuditLog(
				userID,
				req.FileId,
				fileTypeStr,
				ipAddress,
				userAgent,
				0,
				false,
				err.Error(),
			))

			handler.BadRequest(c, apperrors.WrapWithUserMessage(err))
			return
		}
		// Get the detected mapping (includes extracted currency from file metadata)
		columnMapping = excelParser.GetDetectedMapping()
	default:
		// Use CSV parser (default for .csv and any other text format)
		csvParser := parser.NewCSVParser(fileURL, columnMapping)
		parsedRows, err = csvParser.Parse()
		if err != nil {
			metrics.ImportAttempts.WithLabelValues("error", fileTypeStr).Inc()
			logger.LogImportError(c.Request.Context(), userID, "parse:csv", err, logger.ImportErrorMetadata(
				req.FileId, fileTypeStr, 0, 0,
			))

			// Audit log: Failed parse
			logger.LogImportAudit(c.Request.Context(), logger.NewParseAuditLog(
				userID,
				req.FileId,
				fileTypeStr,
				ipAddress,
				userAgent,
				0,
				false,
				err.Error(),
			))

			handler.BadRequest(c, apperrors.WrapWithUserMessage(err))
			return
		}
	}

	// Record parsing duration
	parseDuration := time.Since(parseStart).Seconds()
	metrics.ImportDuration.WithLabelValues("parse").Observe(parseDuration)

	// Convert parsed rows to protobuf format
	var transactions []*v1.ParsedTransaction
	var totalRows, validRows, errorRows, warningRows int32

	for _, row := range parsedRows {
		totalRows++

		// Convert validation errors
		var validationErrors []*v1.ValidationError
		for _, ve := range row.ValidationErrors {
			validationErrors = append(validationErrors, &v1.ValidationError{
				Field:    ve.Field,
				Message:  ve.Message,
				Severity: ve.Severity,
			})

			switch ve.Severity {
			case "error":
				errorRows++
			case "warning":
				warningRows++
			}
		}

		if row.IsValid {
			validRows++
		} else {
			errorRows++
		}

		// Determine transaction type
		txType := v1.TransactionType_TRANSACTION_TYPE_EXPENSE
		if row.Amount > 0 {
			txType = v1.TransactionType_TRANSACTION_TYPE_INCOME
		}

		// Suggest category based on description
		categorySuggestion := parser.SuggestCategory(row.Description, int32(txType))

		// Get currency from the detected mapping (extracted from file metadata)
		// For Excel/PDF: extracted by parsers from "Loại tiền" / "Currency" field
		// For CSV: from bank template or custom mapping
		// Fallback: "VND" if not specified
		currency := "VND"
		if columnMapping != nil && columnMapping.Currency != "" {
			currency = columnMapping.Currency
		}

		transactions = append(transactions, &v1.ParsedTransaction{
			RowNumber:   int32(row.RowNumber),
			Date:        row.Date.Unix(),
			Amount: &v1.Money{
				Amount:   row.Amount,
				Currency: currency,
			},
			Description:         row.Description,
			OriginalDescription: row.OriginalDescription,
			Type:                txType,
			SuggestedCategoryId: categorySuggestion.CategoryID,
			CategoryConfidence:  categorySuggestion.Confidence,
			ReferenceNumber:     row.ReferenceNum,
			ValidationErrors:    validationErrors,
			IsValid:             row.IsValid,
		})
	}

	// Detect currencies used in transactions
	currenciesUsed := make(map[string]int)
	for _, tx := range transactions {
		if tx.Amount != nil && tx.Amount.Currency != "" {
			currenciesUsed[tx.Amount.Currency]++
		}
	}

	// Get the primary currency from the statement file (extracted from metadata)
	// Note: Actual wallet currency will be determined later in ConvertCurrency step
	// This is just an indicator for the frontend to show currency info
	statementCurrency := "VND" // Default
	if columnMapping != nil && columnMapping.Currency != "" {
		statementCurrency = columnMapping.Currency
	}

	// Determine if conversion might be needed (if multiple currencies detected)
	// The actual conversion decision is made in ConvertCurrency after fetching wallet
	needsConversion := false
	for currency := range currenciesUsed {
		if currency != statementCurrency {
			needsConversion = true
			break
		}
	}

	// Build currency list
	currencyList := make([]string, 0, len(currenciesUsed))
	for currency := range currenciesUsed {
		currencyList = append(currencyList, currency)
	}

	// Build response
	response := &v1.ParseStatementResponse{
		Success:      true,
		Message:      fmt.Sprintf("Parsed %d transactions", totalRows),
		Transactions: transactions,
		Statistics: &v1.ParseStatistics{
			TotalRows:   totalRows,
			ValidRows:   validRows,
			ErrorRows:   errorRows,
			WarningRows: warningRows,
		},
		CurrencyInfo: &v1.CurrencyInfo{
			WalletCurrency:  statementCurrency, // Note: This is the statement currency, not actual wallet currency (determined later in ConvertCurrency)
			CurrenciesFound: currencyList,
			NeedsConversion: needsConversion,
		},
		Timestamp: time.Now().Format(time.RFC3339),
	}

	// Audit log: Successful parse
	logger.LogImportAudit(c.Request.Context(), logger.NewParseAuditLog(
		userID,
		req.FileId,
		fileTypeStr,
		ipAddress,
		userAgent,
		int(totalRows),
		true,
		"",
	))

	handler.Success(c, response)
}

// DetectDuplicates detects potential duplicates for imported transactions.
// @Summary Detect duplicate transactions
// @Tags import
// @Accept json
// @Produce json
// @Param request body v1.DetectDuplicatesRequest true "Detect duplicates request"
// @Success 200 {object} v1.DetectDuplicatesResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/detect-duplicates [post]
func (h *ImportHandler) DetectDuplicates(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req v1.DetectDuplicatesRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate required fields
	if req.WalletId == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("walletId is required"))
		return
	}

	if len(req.Transactions) == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("transactions list cannot be empty"))
		return
	}

	// Detect duplicates via service
	result, err := h.importService.DetectDuplicates(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ConvertCurrency converts imported transactions to wallet currency using exchange rates.
// @Summary Convert transaction currencies
// @Tags import
// @Accept json
// @Produce json
// @Param request body v1.ConvertCurrencyRequest true "Convert currency request"
// @Success 200 {object} v1.ConvertCurrencyResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/convert-currency [post]
func (h *ImportHandler) ConvertCurrency(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req v1.ConvertCurrencyRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate required fields
	if req.WalletId == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("walletId is required"))
		return
	}

	if len(req.Transactions) == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("transactions list cannot be empty"))
		return
	}

	// Convert currencies via service
	result, err := h.importService.ConvertCurrency(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// ConfirmImport confirms and imports parsed transactions.
// @Summary Execute import transactions
// @Tags import
// @Accept json
// @Produce json
// @Param request body v1.ExecuteImportRequest true "Execute import request"
// @Success 200 {object} v1.ExecuteImportResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/execute [post]
func (h *ImportHandler) ConfirmImport(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req v1.ExecuteImportRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Validate required fields
	if req.WalletId == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("walletId is required"))
		return
	}

	if len(req.Transactions) == 0 {
		handler.BadRequest(c, apperrors.NewValidationError("transactions list cannot be empty"))
		return
	}

	// Extract IP address and user agent for audit logging
	ipAddress := device.GetClientIP(c)
	userAgent := c.GetHeader("User-Agent")

	// Execute import via service
	result, err := h.importService.ExecuteImport(c.Request.Context(), userID, &req)
	if err != nil {
		// Audit log: Failed import execution
		logger.LogImportAudit(c.Request.Context(), logger.NewExecuteAuditLog(
			userID,
			req.WalletId,
			"",
			len(req.Transactions),
			ipAddress,
			userAgent,
			false,
			err.Error(),
		))

		handler.HandleError(c, err)
		return
	}

	// Audit log: Successful import execution
	logger.LogImportAudit(c.Request.Context(), logger.NewExecuteAuditLog(
		userID,
		req.WalletId,
		result.ImportBatchId,
		len(req.Transactions),
		ipAddress,
		userAgent,
		true,
		"",
	))

	// Cleanup uploaded file after successful import
	if req.FileId != "" {
		_ = fileupload.CleanupFile(req.FileId) // Best effort cleanup
	}

	handler.Success(c, result)
}

// ListImportBatches retrieves import history for the authenticated user.
// @Summary List import batches
// @Tags import
// @Produce json
// @Param page query int false "Page number (default: 1)"
// @Param page_size query int false "Page size (default: 20, max: 100)"
// @Success 200 {object} v1.GetImportHistoryResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/history [get]
func (h *ImportHandler) ListImportBatches(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Parse pagination parameters
	paginationParams := parsePaginationParamsProto(c)

	// Build request
	req := &v1.GetImportHistoryRequest{
		Pagination: paginationParams,
	}

	// Call service
	result, err := h.importService.GetImportHistory(c.Request.Context(), userID, req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, result)
}

// GetImportBatch retrieves details of a specific import batch.
// @Summary Get import batch details
// @Tags import
// @Produce json
// @Param id path string true "Import batch ID"
// @Success 200 {object} v1.ImportBatch
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/{id} [get]
func (h *ImportHandler) GetImportBatch(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get import ID from path parameter
	importID := c.Param("id")
	if importID == "" {
		handler.BadRequest(c, apperrors.NewValidationError("import batch ID is required"))
		return
	}

	// Get import batch
	batch, err := h.importRepo.GetImportBatchByID(c.Request.Context(), importID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	// Verify ownership
	if batch.UserID != userID {
		handler.NotFound(c, "Import batch not found")
		return
	}

	// Convert to protobuf format
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
				Currency: "VND",
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

	handler.Success(c, pbBatch)
}

// UndoImport undoes an import batch within 24 hours.
// @Summary Undo import batch
// @Tags import
// @Accept json
// @Produce json
// @Param id path string true "Import batch ID"
// @Success 200 {object} v1.UndoImportResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/{id}/undo [post]
func (h *ImportHandler) UndoImport(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get import ID from path parameter
	importID := c.Param("id")
	if importID == "" {
		handler.BadRequest(c, apperrors.NewValidationError("import batch ID is required"))
		return
	}

	// Extract IP address and user agent for audit logging
	ipAddress := device.GetClientIP(c)
	userAgent := c.GetHeader("User-Agent")

	// Get import batch info for audit logging (before undo)
	batch, err := h.importRepo.GetImportBatchByID(c.Request.Context(), importID)
	var walletID int32
	var transactionCount int32
	if err == nil && batch != nil {
		walletID = batch.WalletID
		transactionCount = batch.ValidRows
	}

	// Call service to undo import
	result, err := h.importService.UndoImport(c.Request.Context(), userID, importID)
	if err != nil {
		// Audit log: Failed undo
		logger.LogImportAudit(c.Request.Context(), logger.NewUndoAuditLog(
			userID,
			walletID,
			importID,
			int(transactionCount),
			ipAddress,
			userAgent,
			false,
			err.Error(),
		))

		handler.HandleError(c, err)
		return
	}

	// Audit log: Successful undo
	logger.LogImportAudit(c.Request.Context(), logger.NewUndoAuditLog(
		userID,
		walletID,
		importID,
		int(transactionCount),
		ipAddress,
		userAgent,
		true,
		"",
	))

	handler.Success(c, result)
}

// ListExcelSheets lists all available sheets in an Excel file.
// @Summary List Excel sheets
// @Tags import
// @Produce json
// @Param file_id path string true "File ID from upload"
// @Success 200 {object} v1.ListExcelSheetsResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/excel-sheets/{file_id} [get]
func (h *ImportHandler) ListExcelSheets(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get file ID from path parameter
	fileID := c.Param("file_id")
	if fileID == "" {
		handler.BadRequest(c, apperrors.NewValidationError("file ID is required"))
		return
	}

	// Call service to list sheets
	response, err := h.importService.ListExcelSheets(c.Request.Context(), userID, fileID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// CreateUserTemplate creates a new user template.
// @Summary Create user template
// @Tags import
// @Accept json
// @Produce json
// @Param request body v1.CreateUserTemplateRequest true "Create template request"
// @Success 200 {object} v1.CreateUserTemplateResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/user-templates [post]
func (h *ImportHandler) CreateUserTemplate(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Bind and validate request
	var req v1.CreateUserTemplateRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Create template via service
	response, err := h.importService.CreateUserTemplate(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// ListUserTemplates lists all user templates for the authenticated user.
// @Summary List user templates
// @Tags import
// @Produce json
// @Success 200 {object} v1.ListUserTemplatesResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/user-templates [get]
func (h *ImportHandler) ListUserTemplates(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// List templates via service
	response, err := h.importService.ListUserTemplates(c.Request.Context(), userID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// GetUserTemplate retrieves a specific user template.
// @Summary Get user template
// @Tags import
// @Produce json
// @Param template_id path int true "Template ID"
// @Success 200 {object} v1.GetUserTemplateResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/user-templates/{template_id} [get]
func (h *ImportHandler) GetUserTemplate(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get template ID from path parameter
	templateIDStr := c.Param("template_id")
	templateID, err := strconv.ParseInt(templateIDStr, 10, 32)
	if err != nil {
		handler.BadRequest(c, apperrors.NewValidationError("invalid template ID"))
		return
	}

	// Get template via service
	response, err := h.importService.GetUserTemplate(c.Request.Context(), userID, int32(templateID))
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// UpdateUserTemplate updates an existing user template.
// @Summary Update user template
// @Tags import
// @Accept json
// @Produce json
// @Param template_id path int true "Template ID"
// @Param request body v1.UpdateUserTemplateRequest true "Update template request"
// @Success 200 {object} v1.UpdateUserTemplateResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/user-templates/{template_id} [put]
func (h *ImportHandler) UpdateUserTemplate(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get template ID from path parameter
	templateIDStr := c.Param("template_id")
	templateID, err := strconv.ParseInt(templateIDStr, 10, 32)
	if err != nil {
		handler.BadRequest(c, apperrors.NewValidationError("invalid template ID"))
		return
	}

	// Bind and validate request
	var req v1.UpdateUserTemplateRequest
	if err := handler.BindAndValidate(c, &req); err != nil {
		handler.BadRequest(c, err)
		return
	}

	// Set template ID from path parameter
	req.TemplateId = int32(templateID)

	// Update template via service
	response, err := h.importService.UpdateUserTemplate(c.Request.Context(), userID, &req)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// DeleteUserTemplate deletes a user template.
// @Summary Delete user template
// @Tags import
// @Produce json
// @Param template_id path int true "Template ID"
// @Success 200 {object} v1.DeleteUserTemplateResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/user-templates/{template_id} [delete]
func (h *ImportHandler) DeleteUserTemplate(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get template ID from path parameter
	templateIDStr := c.Param("template_id")
	templateID, err := strconv.ParseInt(templateIDStr, 10, 32)
	if err != nil {
		handler.BadRequest(c, apperrors.NewValidationError("invalid template ID"))
		return
	}

	// Delete template via service
	response, err := h.importService.DeleteUserTemplate(c.Request.Context(), userID, int32(templateID))
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// GetJobStatus retrieves the status of a background import job.
// @Summary Get import job status
// @Tags import
// @Produce json
// @Param job_id path string true "Job ID"
// @Success 200 {object} v1.GetJobStatusResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/jobs/{job_id} [get]
func (h *ImportHandler) GetJobStatus(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get job ID from path parameter
	jobID := c.Param("job_id")
	if jobID == "" {
		handler.BadRequest(c, apperrors.NewValidationError("job ID is required"))
		return
	}

	// Get job status via service
	response, err := h.importService.GetJobStatus(c.Request.Context(), userID, jobID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// CancelJob cancels a background import job.
// @Summary Cancel import job
// @Tags import
// @Produce json
// @Param job_id path string true "Job ID"
// @Success 200 {object} v1.CancelJobResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 404 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/jobs/{job_id}/cancel [post]
func (h *ImportHandler) CancelJob(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get job ID from path parameter
	jobID := c.Param("job_id")
	if jobID == "" {
		handler.BadRequest(c, apperrors.NewValidationError("job ID is required"))
		return
	}

	// Cancel job via service
	response, err := h.importService.CancelJob(c.Request.Context(), userID, jobID)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}

// ListUserJobs retrieves all import jobs for the authenticated user.
// @Summary List user import jobs
// @Tags import
// @Produce json
// @Param status query string false "Filter by job status (queued, processing, completed, failed, cancelled)"
// @Success 200 {object} v1.ListUserJobsResponse
// @Failure 400 {object} types.APIResponse
// @Failure 401 {object} types.APIResponse
// @Failure 500 {object} types.APIResponse
// @Router /api/v1/import/jobs [get]
func (h *ImportHandler) ListUserJobs(c *gin.Context) {
	// Get user ID from context
	userID, ok := handler.GetUserID(c)
	if !ok {
		handler.Unauthorized(c, "User not authenticated")
		return
	}

	// Get optional status filter from query parameter
	statusStr := c.Query("status")
	var statusFilter v1.JobStatus
	if statusStr != "" {
		// Map string to enum
		switch statusStr {
		case "queued":
			statusFilter = v1.JobStatus_JOB_STATUS_QUEUED
		case "processing":
			statusFilter = v1.JobStatus_JOB_STATUS_PROCESSING
		case "completed":
			statusFilter = v1.JobStatus_JOB_STATUS_COMPLETED
		case "failed":
			statusFilter = v1.JobStatus_JOB_STATUS_FAILED
		case "cancelled":
			statusFilter = v1.JobStatus_JOB_STATUS_CANCELLED
		default:
			statusFilter = v1.JobStatus_JOB_STATUS_UNSPECIFIED
		}
	}

	// List jobs via service
	response, err := h.importService.ListUserJobs(c.Request.Context(), userID, statusFilter)
	if err != nil {
		handler.HandleError(c, err)
		return
	}

	handler.Success(c, response)
}
