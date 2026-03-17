/**
 * Sanitizes error messages to prevent accidental display of sensitive info
 * This is a defense-in-depth layer - backend should already sanitize, but
 * this provides extra protection against accidental exposure
 */

// Known safe validation messages that contain sensitive keywords but are
// intentional user-facing errors from the backend (not leaked secrets).
const SAFE_VALIDATION_MESSAGES = new Set([
	"no password set for this account",
	"current password is incorrect",
	"new password must be different from current password",
	"password must be at least 10 characters",
	"password must be at most 72 characters",
	"password must contain at least one uppercase letter",
	"password must contain at least one lowercase letter",
	"password must contain at least one digit",
	"password must contain at least one special character",
	"password already set for this account",
	"username already taken",
]);

// Patterns that indicate sensitive information
const SENSITIVE_PATTERNS = [
	/password/i,
	/secret/i,
	/token/i,
	/jwt/i,
	/host=/i,
	/user=/i,
	/database=/i,
	/postgres/i,
	/mysql/i,
	/redis/i,
	/dial tcp/i,
	/connection refused/i,
	/\.railway\./i,
	/\.internal/i,
	/api[_-]?key/i,
	/auth[_-]?token/i,
];

// Safe default error messages by category
const SAFE_MESSAGES = {
	auth: "Authentication failed. Please try again.",
	network: "Network error. Please check your connection.",
	server: "Server error. Please try again later.",
	validation: "Invalid input. Please check your data.",
	notFound: "Resource not found.",
	default: "An unexpected error occurred. Please try again.",
} as const;

/**
 * Checks if error message contains sensitive information.
 * Known safe validation messages are allowlisted to pass through.
 */
export function containsSensitiveInfo(message: string): boolean {
	if (SAFE_VALIDATION_MESSAGES.has(message.toLowerCase())) {
		return false;
	}
	return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Sanitizes error message by removing sensitive information
 */
export function sanitizeErrorMessage(
	message: string,
	category?: keyof typeof SAFE_MESSAGES,
): string {
	// If message contains sensitive info, replace with safe default
	if (containsSensitiveInfo(message)) {
		console.warn(
			"[SECURITY] Blocked sensitive error message from display:",
			message,
		);
		return category ? SAFE_MESSAGES[category] : SAFE_MESSAGES.default;
	}

	// Message is safe to display
	return message;
}

/**
 * Determines error category from status code
 */
export function categorizeError(statusCode: number): keyof typeof SAFE_MESSAGES {
	if (statusCode === 401 || statusCode === 403) return "auth";
	if (statusCode === 404) return "notFound";
	if (statusCode === 400 || statusCode === 422) return "validation";
	if (statusCode >= 500) return "server";
	if (statusCode === 0) return "network";
	return "default";
}

/**
 * Creates a safe, user-friendly error message from an error object
 */
export function createSafeErrorMessage(
	error: unknown,
	fallback?: string,
): string {
	// Handle ApiRequestError-like objects
	if (error && typeof error === "object" && "message" in error) {
		const message = (error as any).message || "";
		const statusCode = (error as any).statusCode || 0;
		const category = categorizeError(statusCode);

		return sanitizeErrorMessage(message, category);
	}

	// Handle Error objects
	if (error instanceof Error) {
		return sanitizeErrorMessage(error.message, "default");
	}

	// Handle string errors
	if (typeof error === "string") {
		return sanitizeErrorMessage(error, "default");
	}

	// Unknown error type
	return fallback || SAFE_MESSAGES.default;
}
