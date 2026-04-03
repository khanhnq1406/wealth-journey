package errors

// ErrorCodes contains all granular error codes organized by domain.
// Each code follows the DOMAIN_ACTION_REASON naming convention.
type ErrorCodes struct {
	// General / Request Body
	RequestBodyInvalid       string
	RequestBodyFormatInvalid string
	RequestBodyReadFailed    string

	// Wallet Domain
	WalletIdRequired             string
	WalletIdInvalid              string
	WalletInitialBalanceNegative string
	WalletDeleteTargetRequired   string
	WalletDeleteCurrencyMismatch string
	WalletDeleteOptionInvalid    string
	WalletAmountPositive         string
	WalletCurrencyMismatch       string
	WalletInsufficientBalance    string
	WalletTransferSame           string
	WalletAdjustAmountPositive   string
	WalletAdjustTypeRequired     string
	WalletAdjustInsufficient     string
	WalletNotFound               string

	// Transaction Domain
	TransactionAmountRequired      string
	TransactionTypeRequired        string
	TransactionInsufficientBalance string
	TransactionUpdateInsufficient  string
	TransactionTargetInsufficient  string
	TransactionYearRequired        string
	TransactionYearInvalid         string
	TransactionWalletIdsInvalid    string
	TransactionStartDateRequired   string
	TransactionStartDateInvalid    string
	TransactionEndDateRequired     string
	TransactionEndDateInvalid      string
	TransactionCategoryTypeInvalid string
	TransactionDateRangeInvalid    string
	TransactionStartDatePositive   string
	TransactionEndDatePositive     string
	TransactionNotFound            string

	// Category Domain
	CategoryNameRequired string
	CategoryNameTooLong  string
	CategoryTypeInvalid  string
	CategoryNotFound     string

	// Budget Domain
	BudgetNameRequired     string
	BudgetNameTooLong      string
	BudgetItemNameRequired string
	BudgetItemNameTooLong  string
	BudgetAmountNegative   string
	BudgetNotFound         string
	BudgetItemNotFound     string

	// Investment Domain
	InvestmentSymbolRequired         string
	InvestmentNameRequired           string
	InvestmentTypeRequired           string
	InvestmentTypeFilterInvalid      string
	InvestmentQuantityPositive       string
	InvestmentPricePositive          string
	InvestmentFeesNegative           string
	InvestmentTxTypeRequired         string
	InvestmentTxTypeInvalid          string
	InvestmentTxDateFuture           string
	InvestmentDuplicate              string
	InvestmentQueryRequired          string
	InvestmentQueryTooLong           string
	InvestmentSymbolCurrencyRequired string
	InvestmentTypeInvalid            string
	InvestmentNotFound                    string
	InvestmentEditSellInsufficientQty    string

	// Import Domain
	ImportFileRequired                  string
	ImportFilenameRequired              string
	ImportFileIdRequired                string
	ImportFileNotFound                  string
	ImportFileTypeUnsupported           string
	ImportWalletIdRequired              string
	ImportTransactionsEmpty             string
	ImportBatchIdRequired               string
	ImportJobIdRequired                 string
	ImportTemplateIdInvalid             string
	ImportTemplateNameRequired          string
	ImportTemplateColumnMappingRequired string
	ImportTemplateDateFormatRequired    string
	ImportTemplateCurrencyRequired      string
	ImportTemplateColumnMappingInvalid  string
	ImportTemplateFileFormatsInvalid    string
	ImportMaxTransactionsExceeded       string
	ImportTxDateFuture                  string
	ImportTxDateTooOld                  string
	ImportNoValidTransactions           string
	ImportUndoNotAllowed                string
	ImportAlreadyUndone                 string
	ImportUndoExpired                   string
	ImportFileNotExcel                  string
	ImportNoSheets                      string
	ImportBatchNotFound                 string
	ImportJobNotFound                   string
	ImportTemplateNotFound              string

	// Session Domain
	SessionIdRequired    string
	SessionRevokeCurrent string
	SessionNotFound      string

	// User Domain
	UserCurrencyUnsupported        string
	UserCurrencyConversionFailed   string
	UserExchangeRateInvalid        string
	UserLanguageUnsupported        string
	UserNotFound                   string
	UserEmailExists                string
	UserEmailInUse                 string
	UserCurrencyConversionProgress string

	// FX Rate Domain
	FxCurrencyEmpty          string
	FxFromCurrencyUnsupported string
	FxToCurrencyUnsupported   string

	// Market Prices / Charts Domain
	ChartMarketInvalid   string
	ChartPeriodInvalid   string
	ChartGoldCodeInvalid string
	ChartDaysInvalid     string
	ChartTypeInvalid     string

	// Price Override Domain (Admin)
	PriceOverrideRequestInvalid  string
	PriceOverrideCategoryInvalid string
	PriceOverrideTypeCodeTooLong string
	PriceOverrideCurrencyInvalid string
	PriceOverridePricePositive   string
	PriceOverrideNameTooLong     string
	PriceOverrideFilterInvalid   string

	// Site Settings Domain (Admin)
	SettingsRequestInvalid string
	SettingsEmpty          string

	// Community Domain
	CommunityEditOwnPostOnly      string
	CommunityDeleteOwnPostOnly    string
	CommunityDeleteOwnCommentOnly string
	CommunityEditOwnCommentOnly   string
	CommunityPostAlreadyLiked     string
	CommunityAlreadyFollowing     string
	CommunityAlreadyReported      string
	CommunityParentCommentNotFound    string
	CommunityParentCommentWrongPost   string
	CommunityFollowSelf               string
	CommunityReportTargetTypeInvalid  string
	CommunityReportReasonInvalid      string
	CommunityReportOwnContent         string
	CommunityImagePurposeInvalid      string
	CommunityImageInvalid             string
	CommunityImageTooLarge            string
	CommunityImageProcessFailed       string
	CommunityShareOwnPost             string
	CommunityPostNotFound             string
	CommunityWebsiteInvalid           string
	CommunityCommentIdInvalid         string
	CommunityUserIdInvalid            string
	CommunityFileRequired             string
	CommunityFileReadFailed           string
	CommunityRequestBodyInvalid       string

	// Gold Sentiment Domain
	SentimentDirectionInvalid  string
	SentimentCommentRequired   string
	SentimentCommentTooLong    string
	SentimentCommentLimitReached string

	// Analysis Domain
	AnalysisYearInvalid  string
	AnalysisMonthInvalid string
	AnalysisMonthRange   string

	// Authentication Errors (401)
	AuthInvalidCredentials string
	AuthTokenFailed        string
	AuthNoToken            string
	AuthTokenExpired       string
	AuthMissingToken       string
	AuthInvalidToken       string
	AuthLoginFailed        string
	AuthLogoutFailed       string
	AuthRegistrationFailed string
	AuthGoogleNotLinked    string

	// Forbidden Errors (403)
	AuthAdminRequired         string
	AdminCannotModifyOwnRole  string

	// Rate Limit Errors (429)
	FeedbackRateLimited string
	ImportRateLimited   string

	// Internal Server Errors (500)
	InternalError                      string
	SessionListFailed                  string
	SessionVerifyFailed                string
	SessionRevokeFailed                string
	WalletCreateInitialTxFailed        string
	WalletBalanceUpdateFailed          string
	WalletTransferCategoryFailed       string
	WalletTransferTxFailed             string
	WalletAdjustCategoryFailed         string
	WalletAdjustTxFailed               string
	BudgetItemCreateFailed             string
	BudgetItemsDeleteFailed            string
	ImportBalanceVerificationFailed    string
	ImportCurrencyConversionUnavailable string
	SettingsFetchFailed                string
	SettingsUpdateFailed               string
	PriceOverrideSaveFailed            string
	PriceOverrideListFailed            string
	PriceOverrideDeleteFailed          string
	SentimentVoteCountFailed           string
	ImportTemplatesFetchFailed         string

	// Service Unavailable (503)
	AuthServiceUnavailable string
	StreamingUnavailable   string

	// User-Friendly Wrapper Codes
	DbConnectionError   string
	FileParseError      string
	EmptyFileError      string
	InsufficientBalance string
	FileTooLarge        string
	UnsupportedFileType string
	DuplicateDetected   string
	ExchangeRateError   string
	ResourceNotFound    string
}

// Codes is the singleton instance of all error codes.
var Codes = ErrorCodes{
	// General / Request Body
	RequestBodyInvalid:       "REQUEST_BODY_INVALID",
	RequestBodyFormatInvalid: "REQUEST_BODY_FORMAT_INVALID",
	RequestBodyReadFailed:    "REQUEST_BODY_READ_FAILED",

	// Wallet Domain
	WalletIdRequired:             "WALLET_ID_REQUIRED",
	WalletIdInvalid:              "WALLET_ID_INVALID",
	WalletInitialBalanceNegative: "WALLET_INITIAL_BALANCE_NEGATIVE",
	WalletDeleteTargetRequired:   "WALLET_DELETE_TARGET_REQUIRED",
	WalletDeleteCurrencyMismatch: "WALLET_DELETE_CURRENCY_MISMATCH",
	WalletDeleteOptionInvalid:    "WALLET_DELETE_OPTION_INVALID",
	WalletAmountPositive:         "WALLET_AMOUNT_POSITIVE",
	WalletCurrencyMismatch:       "WALLET_CURRENCY_MISMATCH",
	WalletInsufficientBalance:    "WALLET_INSUFFICIENT_BALANCE",
	WalletTransferSame:           "WALLET_TRANSFER_SAME",
	WalletAdjustAmountPositive:   "WALLET_ADJUST_AMOUNT_POSITIVE",
	WalletAdjustTypeRequired:     "WALLET_ADJUST_TYPE_REQUIRED",
	WalletAdjustInsufficient:     "WALLET_ADJUST_INSUFFICIENT",
	WalletNotFound:               "WALLET_NOT_FOUND",

	// Transaction Domain
	TransactionAmountRequired:      "TRANSACTION_AMOUNT_REQUIRED",
	TransactionTypeRequired:        "TRANSACTION_TYPE_REQUIRED",
	TransactionInsufficientBalance: "TRANSACTION_INSUFFICIENT_BALANCE",
	TransactionUpdateInsufficient:  "TRANSACTION_UPDATE_INSUFFICIENT",
	TransactionTargetInsufficient:  "TRANSACTION_TARGET_INSUFFICIENT",
	TransactionYearRequired:        "TRANSACTION_YEAR_REQUIRED",
	TransactionYearInvalid:         "TRANSACTION_YEAR_INVALID",
	TransactionWalletIdsInvalid:    "TRANSACTION_WALLET_IDS_INVALID",
	TransactionStartDateRequired:   "TRANSACTION_START_DATE_REQUIRED",
	TransactionStartDateInvalid:    "TRANSACTION_START_DATE_INVALID",
	TransactionEndDateRequired:     "TRANSACTION_END_DATE_REQUIRED",
	TransactionEndDateInvalid:      "TRANSACTION_END_DATE_INVALID",
	TransactionCategoryTypeInvalid: "TRANSACTION_CATEGORY_TYPE_INVALID",
	TransactionDateRangeInvalid:    "TRANSACTION_DATE_RANGE_INVALID",
	TransactionStartDatePositive:   "TRANSACTION_START_DATE_POSITIVE",
	TransactionEndDatePositive:     "TRANSACTION_END_DATE_POSITIVE",
	TransactionNotFound:            "TRANSACTION_NOT_FOUND",

	// Category Domain
	CategoryNameRequired: "CATEGORY_NAME_REQUIRED",
	CategoryNameTooLong:  "CATEGORY_NAME_TOO_LONG",
	CategoryTypeInvalid:  "CATEGORY_TYPE_INVALID",
	CategoryNotFound:     "CATEGORY_NOT_FOUND",

	// Budget Domain
	BudgetNameRequired:     "BUDGET_NAME_REQUIRED",
	BudgetNameTooLong:      "BUDGET_NAME_TOO_LONG",
	BudgetItemNameRequired: "BUDGET_ITEM_NAME_REQUIRED",
	BudgetItemNameTooLong:  "BUDGET_ITEM_NAME_TOO_LONG",
	BudgetAmountNegative:   "BUDGET_AMOUNT_NEGATIVE",
	BudgetNotFound:         "BUDGET_NOT_FOUND",
	BudgetItemNotFound:     "BUDGET_ITEM_NOT_FOUND",

	// Investment Domain
	InvestmentSymbolRequired:         "INVESTMENT_SYMBOL_REQUIRED",
	InvestmentNameRequired:           "INVESTMENT_NAME_REQUIRED",
	InvestmentTypeRequired:           "INVESTMENT_TYPE_REQUIRED",
	InvestmentTypeFilterInvalid:      "INVESTMENT_TYPE_FILTER_INVALID",
	InvestmentQuantityPositive:       "INVESTMENT_QUANTITY_POSITIVE",
	InvestmentPricePositive:          "INVESTMENT_PRICE_POSITIVE",
	InvestmentFeesNegative:           "INVESTMENT_FEES_NEGATIVE",
	InvestmentTxTypeRequired:         "INVESTMENT_TX_TYPE_REQUIRED",
	InvestmentTxTypeInvalid:          "INVESTMENT_TX_TYPE_INVALID",
	InvestmentTxDateFuture:           "INVESTMENT_TX_DATE_FUTURE",
	InvestmentDuplicate:              "INVESTMENT_DUPLICATE",
	InvestmentQueryRequired:          "INVESTMENT_QUERY_REQUIRED",
	InvestmentQueryTooLong:           "INVESTMENT_QUERY_TOO_LONG",
	InvestmentSymbolCurrencyRequired: "INVESTMENT_SYMBOL_CURRENCY_REQUIRED",
	InvestmentTypeInvalid:            "INVESTMENT_TYPE_INVALID",
	InvestmentNotFound:                    "INVESTMENT_NOT_FOUND",
	InvestmentEditSellInsufficientQty:    "INVESTMENT_EDIT_SELL_INSUFFICIENT_QTY",

	// Import Domain
	ImportFileRequired:                  "IMPORT_FILE_REQUIRED",
	ImportFilenameRequired:              "IMPORT_FILENAME_REQUIRED",
	ImportFileIdRequired:                "IMPORT_FILE_ID_REQUIRED",
	ImportFileNotFound:                  "IMPORT_FILE_NOT_FOUND",
	ImportFileTypeUnsupported:           "IMPORT_FILE_TYPE_UNSUPPORTED",
	ImportWalletIdRequired:              "IMPORT_WALLET_ID_REQUIRED",
	ImportTransactionsEmpty:             "IMPORT_TRANSACTIONS_EMPTY",
	ImportBatchIdRequired:               "IMPORT_BATCH_ID_REQUIRED",
	ImportJobIdRequired:                 "IMPORT_JOB_ID_REQUIRED",
	ImportTemplateIdInvalid:             "IMPORT_TEMPLATE_ID_INVALID",
	ImportTemplateNameRequired:          "IMPORT_TEMPLATE_NAME_REQUIRED",
	ImportTemplateColumnMappingRequired: "IMPORT_TEMPLATE_COLUMN_MAPPING_REQUIRED",
	ImportTemplateDateFormatRequired:    "IMPORT_TEMPLATE_DATE_FORMAT_REQUIRED",
	ImportTemplateCurrencyRequired:      "IMPORT_TEMPLATE_CURRENCY_REQUIRED",
	ImportTemplateColumnMappingInvalid:  "IMPORT_TEMPLATE_COLUMN_MAPPING_INVALID",
	ImportTemplateFileFormatsInvalid:    "IMPORT_TEMPLATE_FILE_FORMATS_INVALID",
	ImportMaxTransactionsExceeded:       "IMPORT_MAX_TRANSACTIONS_EXCEEDED",
	ImportTxDateFuture:                  "IMPORT_TX_DATE_FUTURE",
	ImportTxDateTooOld:                  "IMPORT_TX_DATE_TOO_OLD",
	ImportNoValidTransactions:           "IMPORT_NO_VALID_TRANSACTIONS",
	ImportUndoNotAllowed:                "IMPORT_UNDO_NOT_ALLOWED",
	ImportAlreadyUndone:                 "IMPORT_ALREADY_UNDONE",
	ImportUndoExpired:                   "IMPORT_UNDO_EXPIRED",
	ImportFileNotExcel:                  "IMPORT_FILE_NOT_EXCEL",
	ImportNoSheets:                      "IMPORT_NO_SHEETS",
	ImportBatchNotFound:                 "IMPORT_BATCH_NOT_FOUND",
	ImportJobNotFound:                   "IMPORT_JOB_NOT_FOUND",
	ImportTemplateNotFound:              "IMPORT_TEMPLATE_NOT_FOUND",

	// Session Domain
	SessionIdRequired:    "SESSION_ID_REQUIRED",
	SessionRevokeCurrent: "SESSION_REVOKE_CURRENT",
	SessionNotFound:      "SESSION_NOT_FOUND",

	// User Domain
	UserCurrencyUnsupported:        "USER_CURRENCY_UNSUPPORTED",
	UserCurrencyConversionFailed:   "USER_CURRENCY_CONVERSION_FAILED",
	UserExchangeRateInvalid:        "USER_EXCHANGE_RATE_INVALID",
	UserLanguageUnsupported:        "USER_LANGUAGE_UNSUPPORTED",
	UserNotFound:                   "USER_NOT_FOUND",
	UserEmailExists:                "USER_EMAIL_EXISTS",
	UserEmailInUse:                 "USER_EMAIL_IN_USE",
	UserCurrencyConversionProgress: "USER_CURRENCY_CONVERSION_IN_PROGRESS",

	// FX Rate Domain
	FxCurrencyEmpty:           "FX_CURRENCY_EMPTY",
	FxFromCurrencyUnsupported: "FX_FROM_CURRENCY_UNSUPPORTED",
	FxToCurrencyUnsupported:   "FX_TO_CURRENCY_UNSUPPORTED",

	// Market Prices / Charts Domain
	ChartMarketInvalid:   "CHART_MARKET_INVALID",
	ChartPeriodInvalid:   "CHART_PERIOD_INVALID",
	ChartGoldCodeInvalid: "CHART_GOLD_CODE_INVALID",
	ChartDaysInvalid:     "CHART_DAYS_INVALID",
	ChartTypeInvalid:     "CHART_TYPE_INVALID",

	// Price Override Domain (Admin)
	PriceOverrideRequestInvalid:  "PRICE_OVERRIDE_REQUEST_INVALID",
	PriceOverrideCategoryInvalid: "PRICE_OVERRIDE_CATEGORY_INVALID",
	PriceOverrideTypeCodeTooLong: "PRICE_OVERRIDE_TYPE_CODE_TOO_LONG",
	PriceOverrideCurrencyInvalid: "PRICE_OVERRIDE_CURRENCY_INVALID",
	PriceOverridePricePositive:   "PRICE_OVERRIDE_PRICE_POSITIVE",
	PriceOverrideNameTooLong:     "PRICE_OVERRIDE_NAME_TOO_LONG",
	PriceOverrideFilterInvalid:   "PRICE_OVERRIDE_FILTER_INVALID",

	// Site Settings Domain (Admin)
	SettingsRequestInvalid: "SETTINGS_REQUEST_INVALID",
	SettingsEmpty:          "SETTINGS_EMPTY",

	// Community Domain
	CommunityEditOwnPostOnly:      "COMMUNITY_EDIT_OWN_POST_ONLY",
	CommunityDeleteOwnPostOnly:    "COMMUNITY_DELETE_OWN_POST_ONLY",
	CommunityDeleteOwnCommentOnly: "COMMUNITY_DELETE_OWN_COMMENT_ONLY",
	CommunityEditOwnCommentOnly:   "COMMUNITY_EDIT_OWN_COMMENT_ONLY",
	CommunityPostAlreadyLiked:     "COMMUNITY_POST_ALREADY_LIKED",
	CommunityAlreadyFollowing:     "COMMUNITY_ALREADY_FOLLOWING",
	CommunityAlreadyReported:      "COMMUNITY_ALREADY_REPORTED",
	CommunityParentCommentNotFound:    "COMMUNITY_PARENT_COMMENT_NOT_FOUND",
	CommunityParentCommentWrongPost:   "COMMUNITY_PARENT_COMMENT_WRONG_POST",
	CommunityFollowSelf:               "COMMUNITY_FOLLOW_SELF",
	CommunityReportTargetTypeInvalid:  "COMMUNITY_REPORT_TARGET_TYPE_INVALID",
	CommunityReportReasonInvalid:      "COMMUNITY_REPORT_REASON_INVALID",
	CommunityReportOwnContent:         "COMMUNITY_REPORT_OWN_CONTENT",
	CommunityImagePurposeInvalid:      "COMMUNITY_IMAGE_PURPOSE_INVALID",
	CommunityImageInvalid:             "COMMUNITY_IMAGE_INVALID",
	CommunityImageTooLarge:            "COMMUNITY_IMAGE_TOO_LARGE",
	CommunityImageProcessFailed:       "COMMUNITY_IMAGE_PROCESS_FAILED",
	CommunityShareOwnPost:             "COMMUNITY_SHARE_OWN_POST",
	CommunityPostNotFound:             "COMMUNITY_POST_NOT_FOUND",
	CommunityWebsiteInvalid:           "COMMUNITY_WEBSITE_INVALID",
	CommunityCommentIdInvalid:         "COMMUNITY_COMMENT_ID_INVALID",
	CommunityUserIdInvalid:            "COMMUNITY_USER_ID_INVALID",
	CommunityFileRequired:             "COMMUNITY_FILE_REQUIRED",
	CommunityFileReadFailed:           "COMMUNITY_FILE_READ_FAILED",
	CommunityRequestBodyInvalid:       "COMMUNITY_REQUEST_BODY_INVALID",

	// Gold Sentiment Domain
	SentimentDirectionInvalid:    "SENTIMENT_DIRECTION_INVALID",
	SentimentCommentRequired:     "SENTIMENT_COMMENT_REQUIRED",
	SentimentCommentTooLong:      "SENTIMENT_COMMENT_TOO_LONG",
	SentimentCommentLimitReached: "SENTIMENT_COMMENT_LIMIT_REACHED",

	// Analysis Domain
	AnalysisYearInvalid:  "ANALYSIS_YEAR_INVALID",
	AnalysisMonthInvalid: "ANALYSIS_MONTH_INVALID",
	AnalysisMonthRange:   "ANALYSIS_MONTH_RANGE",

	// Authentication Errors (401)
	AuthInvalidCredentials: "AUTH_INVALID_CREDENTIALS",
	AuthTokenFailed:        "AUTH_TOKEN_FAILED",
	AuthNoToken:            "AUTH_NO_TOKEN",
	AuthTokenExpired:       "AUTH_TOKEN_EXPIRED",
	AuthMissingToken:       "AUTH_MISSING_TOKEN",
	AuthInvalidToken:       "AUTH_INVALID_TOKEN",
	AuthLoginFailed:        "AUTH_LOGIN_FAILED",
	AuthLogoutFailed:       "AUTH_LOGOUT_FAILED",
	AuthRegistrationFailed: "AUTH_REGISTRATION_FAILED",
	AuthGoogleNotLinked:    "AUTH_GOOGLE_NOT_LINKED",

	// Forbidden Errors (403)
	AuthAdminRequired:        "AUTH_ADMIN_REQUIRED",
	AdminCannotModifyOwnRole: "ADMIN_CANNOT_MODIFY_OWN_ROLE",

	// Rate Limit Errors (429)
	FeedbackRateLimited: "FEEDBACK_RATE_LIMITED",
	ImportRateLimited:   "IMPORT_RATE_LIMITED",

	// Internal Server Errors (500)
	InternalError:                       "INTERNAL_ERROR",
	SessionListFailed:                   "SESSION_LIST_FAILED",
	SessionVerifyFailed:                 "SESSION_VERIFY_FAILED",
	SessionRevokeFailed:                 "SESSION_REVOKE_FAILED",
	WalletCreateInitialTxFailed:         "WALLET_CREATE_INITIAL_TX_FAILED",
	WalletBalanceUpdateFailed:           "WALLET_BALANCE_UPDATE_FAILED",
	WalletTransferCategoryFailed:        "WALLET_TRANSFER_CATEGORY_FAILED",
	WalletTransferTxFailed:              "WALLET_TRANSFER_TX_FAILED",
	WalletAdjustCategoryFailed:          "WALLET_ADJUST_CATEGORY_FAILED",
	WalletAdjustTxFailed:                "WALLET_ADJUST_TX_FAILED",
	BudgetItemCreateFailed:              "BUDGET_ITEM_CREATE_FAILED",
	BudgetItemsDeleteFailed:             "BUDGET_ITEMS_DELETE_FAILED",
	ImportBalanceVerificationFailed:     "IMPORT_BALANCE_VERIFICATION_FAILED",
	ImportCurrencyConversionUnavailable: "IMPORT_CURRENCY_CONVERSION_UNAVAILABLE",
	SettingsFetchFailed:                 "SETTINGS_FETCH_FAILED",
	SettingsUpdateFailed:                "SETTINGS_UPDATE_FAILED",
	PriceOverrideSaveFailed:             "PRICE_OVERRIDE_SAVE_FAILED",
	PriceOverrideListFailed:             "PRICE_OVERRIDE_LIST_FAILED",
	PriceOverrideDeleteFailed:           "PRICE_OVERRIDE_DELETE_FAILED",
	SentimentVoteCountFailed:            "SENTIMENT_VOTE_COUNT_FAILED",
	ImportTemplatesFetchFailed:          "IMPORT_TEMPLATES_FETCH_FAILED",

	// Service Unavailable (503)
	AuthServiceUnavailable: "AUTH_SERVICE_UNAVAILABLE",
	StreamingUnavailable:   "STREAMING_UNAVAILABLE",

	// User-Friendly Wrapper Codes
	DbConnectionError:   "DB_CONNECTION_ERROR",
	FileParseError:      "FILE_PARSE_ERROR",
	EmptyFileError:      "EMPTY_FILE_ERROR",
	InsufficientBalance: "INSUFFICIENT_BALANCE",
	FileTooLarge:        "FILE_TOO_LARGE",
	UnsupportedFileType: "UNSUPPORTED_FILE_TYPE",
	DuplicateDetected:   "DUPLICATE_DETECTED",
	ExchangeRateError:   "EXCHANGE_RATE_ERROR",
	ResourceNotFound:    "RESOURCE_NOT_FOUND",
}
