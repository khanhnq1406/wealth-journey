package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server       Server
	Database     Database
	Redis        Redis
	JWT          JWT
	Google       Google
	RateLimit    RateLimit
	YahooFinance YahooFinance
	FX           FX
	Import       Import
	Storage      Storage
	CORS         CORS
}

type CORS struct {
	AllowedOrigins []string
}

type Server struct {
	Port            string
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
}

type Database struct {
	Host            string
	Port            string
	User            string
	Password        string
	Name            string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

type Redis struct {
	URL      string
	Password string
	DB       int
}

type JWT struct {
	Secret     string
	Expiration time.Duration
}

type Google struct {
	ClientID string
}

type RateLimit struct {
	RequestsPerMinute int
}

type YahooFinance struct {
	Enabled          bool
	Timeout          time.Duration
	MaxRetries       int
	RetryDelay       time.Duration
	CacheMaxAge      time.Duration
	FallbackToStale  bool
	RequestsPerMin   int
}

type FX struct {
	Enabled               bool
	APIBaseURL            string
	Timeout               time.Duration
	HistoricalCacheTTL    time.Duration // 7 days
	LatestCacheTTL        time.Duration // 1 hour
	FallbackToLatest      bool
	MaxRetries            int
}

type Import struct {
	MaxCSVSize                   int64         // Maximum CSV file size in bytes
	MaxExcelSize                 int64         // Maximum Excel file size in bytes
	MaxPDFSize                   int64         // Maximum PDF file size in bytes
	MaxTransactionsPerImport     int           // Maximum number of transactions per import
	MaxImportsPerHour            int           // Maximum imports per user per hour
	MaxImportsPerHourPerIP       int           // Maximum imports per IP per hour
	MaxImportsPerDayPerWallet    int           // Maximum imports per wallet per day
	ParseTimeout                 time.Duration // Timeout for parsing operations
	EnableOCR                    bool          // Enable OCR for PDFs
	DuplicateConfidenceThreshold float64       // Minimum confidence to consider as duplicate (0-100)
	UndoWindowHours              int           // Hours within which undo is allowed

	// Validation configuration
	ValidationZeroAmountPolicy   string // How to handle zero amounts: "error", "warning", or "ignore"
	ValidationLargeAmountThreshold int64  // Threshold for large amount warnings in VND (smallest unit)
	ValidationOldDateThresholdDays int    // Number of days after which a date is considered old
}

type Storage struct {
	Provider                string // "supabase" or "local" (for backward compatibility)
	SupabaseURL             string
	SupabaseAPIKey          string
	SupabaseBucket          string // Private bucket for financial documents
	SupabaseCommunityBucket string // Public bucket for community images
	UploadDir               string // Local fallback directory
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Load .env file if exists
	_ = godotenv.Load()

	// Parse durations
	readTimeout, _ := time.ParseDuration(getEnv("SERVER_READ_TIMEOUT", "10s"))
	writeTimeout, _ := time.ParseDuration(getEnv("SERVER_WRITE_TIMEOUT", "10s"))
	shutdownTimeout, _ := time.ParseDuration(getEnv("SERVER_SHUTDOWN_TIMEOUT", "30s"))

	jwtExpiration, _ := time.ParseDuration(os.Getenv("JWT_EXPIRATION"))
	if jwtExpiration == 0 {
		jwtExpiration = 168 * time.Hour // 7 days default
	}

	// Database pool settings
	// Railway Hobby tier (1 CPU, 512MB RAM): use conservative settings to prevent resource exhaustion
	// These defaults can be overridden via environment variables for other deployments
	maxOpenConns, err := strconv.Atoi(getEnv("DB_MAX_OPEN_CONNS", "5"))
	if err != nil || maxOpenConns < 1 {
		maxOpenConns = 5 // fallback to default on invalid input
	}

	maxIdleConns, err := strconv.Atoi(getEnv("DB_MAX_IDLE_CONNS", "2"))
	if err != nil || maxIdleConns < 0 {
		maxIdleConns = 2 // fallback to default on invalid input
	}

	// Faster connection rotation prevents stale connections on resource-constrained environments
	connMaxLifetime, err := time.ParseDuration(getEnv("DB_CONN_MAX_LIFETIME", "30m"))
	if err != nil || connMaxLifetime <= 0 {
		connMaxLifetime = 30 * time.Minute // fallback to default on invalid input
	}

	// Close idle connections faster to free resources on memory-constrained Railway
	connMaxIdleTime, err := time.ParseDuration(getEnv("DB_CONN_MAX_IDLE_TIME", "5m"))
	if err != nil || connMaxIdleTime <= 0 {
		connMaxIdleTime = 5 * time.Minute // fallback to default on invalid input
	}

	// Rate limit settings
	requestsPerMinute, _ := strconv.Atoi(getEnv("RATE_LIMIT_REQUESTS_PER_MINUTE", "60"))

	// Yahoo Finance settings
	yahooTimeout, _ := time.ParseDuration(getEnv("YAHOO_FINANCE_TIMEOUT", "10s"))
	yahooRetryDelay, _ := time.ParseDuration(getEnv("YAHOO_FINANCE_RETRY_DELAY", "1s"))
	yahooCacheMaxAge, _ := time.ParseDuration(getEnv("YAHOO_FINANCE_CACHE_MAX_AGE", "15m"))
	yahooMaxRetries, _ := strconv.Atoi(getEnv("YAHOO_FINANCE_MAX_RETRIES", "3"))
	yahooRequestsPerMin, _ := strconv.Atoi(getEnv("YAHOO_FINANCE_REQUESTS_PER_MIN", "120"))
	yahooEnabled, _ := strconv.ParseBool(getEnv("YAHOO_FINANCE_ENABLED", "true"))
	yahooFallbackToStale, _ := strconv.ParseBool(getEnv("YAHOO_FINANCE_FALLBACK_STALE", "true"))

	// FX (Exchange Rate) settings
	fxEnabled, _ := strconv.ParseBool(getEnv("FX_ENABLED", "true"))
	fxTimeout, _ := time.ParseDuration(getEnv("FX_TIMEOUT", "10s"))
	fxHistoricalCacheTTL, _ := time.ParseDuration(getEnv("FX_HISTORICAL_CACHE_TTL", "168h")) // 7 days
	fxLatestCacheTTL, _ := time.ParseDuration(getEnv("FX_LATEST_CACHE_TTL", "1h"))
	fxFallbackToLatest, _ := strconv.ParseBool(getEnv("FX_FALLBACK_TO_LATEST", "true"))
	fxMaxRetries, _ := strconv.Atoi(getEnv("FX_MAX_RETRIES", "3"))

	// Import settings
	maxCSVSize, _ := strconv.ParseInt(getEnv("IMPORT_MAX_CSV_SIZE", "10485760"), 10, 64)        // 10MB
	maxExcelSize, _ := strconv.ParseInt(getEnv("IMPORT_MAX_EXCEL_SIZE", "10485760"), 10, 64)    // 10MB
	maxPDFSize, _ := strconv.ParseInt(getEnv("IMPORT_MAX_PDF_SIZE", "20971520"), 10, 64)        // 20MB
	maxTransactionsPerImport, _ := strconv.Atoi(getEnv("IMPORT_MAX_TRANSACTIONS", "10000"))
	maxImportsPerHour, _ := strconv.Atoi(getEnv("IMPORT_MAX_PER_HOUR", "10"))
	maxImportsPerHourPerIP, _ := strconv.Atoi(getEnv("IMPORT_MAX_PER_HOUR_PER_IP", "50"))
	maxImportsPerDayPerWallet, _ := strconv.Atoi(getEnv("IMPORT_MAX_PER_DAY_PER_WALLET", "20"))
	parseTimeout, _ := time.ParseDuration(getEnv("IMPORT_PARSE_TIMEOUT", "30s"))
	enableOCR, _ := strconv.ParseBool(getEnv("IMPORT_ENABLE_OCR", "true"))
	duplicateThreshold, _ := strconv.ParseFloat(getEnv("IMPORT_DUPLICATE_THRESHOLD", "80"), 64)
	undoWindowHours, _ := strconv.Atoi(getEnv("IMPORT_UNDO_WINDOW_HOURS", "24"))

	// Validation settings
	validationZeroAmountPolicy := getEnv("VALIDATION_ZERO_AMOUNT", "error") // "error", "warning", or "ignore"
	validationLargeAmountThreshold, _ := strconv.ParseInt(getEnv("VALIDATION_LARGE_AMOUNT_THRESHOLD", "10000000000000"), 10, 64) // 1B VND
	validationOldDateThresholdDays, _ := strconv.Atoi(getEnv("VALIDATION_OLD_DATE_THRESHOLD_DAYS", "365")) // 1 year

	cfg := &Config{
		Server: Server{
			Port:            getEnv("PORT", "5000"),
			ReadTimeout:     readTimeout,
			WriteTimeout:    writeTimeout,
			ShutdownTimeout: shutdownTimeout,
		},
		Database: Database{
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnv("DB_PORT", "3306"),
			User:            getEnv("DB_USER", "root"),
			Password:        getEnv("DB_PASSWORD", ""),
			Name:            getEnv("DB_NAME", "wealthjourney"),
			MaxOpenConns:    maxOpenConns,
			MaxIdleConns:    maxIdleConns,
			ConnMaxLifetime: connMaxLifetime,
			ConnMaxIdleTime: connMaxIdleTime,
		},
		Redis: Redis{
			URL:      getEnv("REDIS_URL", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       0,
		},
		JWT: JWT{
			Secret:     getEnv("JWT_SECRET", "your-secret-key"),
			Expiration: jwtExpiration,
		},
		Google: Google{
			ClientID: getEnv("GOOGLE_CLIENT_ID", ""),
		},
		RateLimit: RateLimit{
			RequestsPerMinute: requestsPerMinute,
		},
		YahooFinance: YahooFinance{
			Enabled:         yahooEnabled,
			Timeout:         yahooTimeout,
			MaxRetries:      yahooMaxRetries,
			RetryDelay:      yahooRetryDelay,
			CacheMaxAge:     yahooCacheMaxAge,
			FallbackToStale: yahooFallbackToStale,
			RequestsPerMin:  yahooRequestsPerMin,
		},
		FX: FX{
			Enabled:            fxEnabled,
			APIBaseURL:         getEnv("FX_API_BASE_URL", "https://api.exchangerate-api.com/v4"),
			Timeout:            fxTimeout,
			HistoricalCacheTTL: fxHistoricalCacheTTL,
			LatestCacheTTL:     fxLatestCacheTTL,
			FallbackToLatest:   fxFallbackToLatest,
			MaxRetries:         fxMaxRetries,
		},
		Import: Import{
			MaxCSVSize:                   maxCSVSize,
			MaxExcelSize:                 maxExcelSize,
			MaxPDFSize:                   maxPDFSize,
			MaxTransactionsPerImport:     maxTransactionsPerImport,
			MaxImportsPerHour:            maxImportsPerHour,
			MaxImportsPerHourPerIP:       maxImportsPerHourPerIP,
			MaxImportsPerDayPerWallet:    maxImportsPerDayPerWallet,
			ParseTimeout:                 parseTimeout,
			EnableOCR:                    enableOCR,
			DuplicateConfidenceThreshold: duplicateThreshold,
			UndoWindowHours:              undoWindowHours,
			ValidationZeroAmountPolicy:   validationZeroAmountPolicy,
			ValidationLargeAmountThreshold: validationLargeAmountThreshold,
			ValidationOldDateThresholdDays: validationOldDateThresholdDays,
		},
		Storage: Storage{
			Provider:                getEnv("STORAGE_PROVIDER", "supabase"),
			SupabaseURL:             getEnv("SUPABASE_URL", ""),
			SupabaseAPIKey:          getEnv("SUPABASE_API_KEY", ""),
			SupabaseBucket:          getEnv("SUPABASE_BUCKET", "wealthjourney-uploads"),
			SupabaseCommunityBucket: getEnv("SUPABASE_COMMUNITY_BUCKET", "community"),
			UploadDir:               getEnv("UPLOAD_DIR", "/tmp/wealthjourney-uploads"),
		},
		CORS: CORS{
			AllowedOrigins: parseCORSAllowedOrigins(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		},
	}

	// Validate configuration (skip validation in Vercel environment to allow graceful degradation)
	if os.Getenv("VERCEL") != "1" {
		if err := cfg.Validate(); err != nil {
			return nil, fmt.Errorf("invalid configuration: %w", err)
		}
	}

	return cfg, nil
}

// Validate validates the configuration.
func (c *Config) Validate() error {
	// Validate required fields
	if c.Database.Name == "" {
		return errors.New("database name is required")
	}
	if c.JWT.Secret == "" || c.JWT.Secret == "your-secret-key" || len(c.JWT.Secret) < 10 {
		return errors.New("JWT_SECRET must be set to a secure value (at least 10 characters)")
	}

	// Validate port number
	if c.Server.Port == "" {
		return errors.New("server port is required")
	}

	// Validate connection pool settings
	if c.Database.MaxOpenConns < 1 {
		return errors.New("DB_MAX_OPEN_CONNS must be at least 1")
	}
	if c.Database.MaxIdleConns < 0 {
		return errors.New("DB_MAX_IDLE_CONNS cannot be negative")
	}
	if c.Database.MaxIdleConns > c.Database.MaxOpenConns {
		return errors.New("DB_MAX_IDLE_CONNS cannot be greater than DB_MAX_OPEN_CONNS")
	}

	// Validate rate limit
	if c.RateLimit.RequestsPerMinute < 1 {
		return errors.New("RATE_LIMIT_REQUESTS_PER_MINUTE must be at least 1")
	}

	return nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// parseCORSAllowedOrigins splits a comma-separated list of origins, trims whitespace,
// and drops empty entries.
func parseCORSAllowedOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
