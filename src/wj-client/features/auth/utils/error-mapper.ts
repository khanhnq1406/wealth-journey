/**
 * Maps server error message strings (English) to i18n translation keys.
 *
 * The backend returns error messages in English. This mapper translates them
 * to i18n keys so the frontend can display user-friendly, localized messages.
 */

/** Error map for register password form (uses auth.register.errors namespace) */
const REGISTER_ERROR_MAP: Record<string, string> = {
  "username is required": "usernameRequired",
  "username must be at least 3 characters": "usernameMinLength",
  "username must be at most 30 characters": "usernameMaxLength",
  "username can only contain letters, numbers, and underscores":
    "usernameInvalidChars",
  "username already taken": "usernameAlreadyTaken",
  "display name is required": "displayNameRequired",
  "password must be at least 10 characters": "passwordMinLength",
  "password must be at most 72 characters": "passwordMaxLength",
  "password must contain at least one uppercase letter":
    "passwordNeedsUppercase",
  "password must contain at least one lowercase letter":
    "passwordNeedsLowercase",
  "password must contain at least one digit": "passwordNeedsDigit",
  "password must contain at least one special character":
    "passwordNeedsSpecial",
};

/** Error map for link password form (uses settings.security.errors namespace) */
const LINK_PASSWORD_ERROR_MAP: Record<string, string> = {
  "password already set for this account": "passwordAlreadySet",
  "username already taken": "usernameAlreadyTaken",
  "username is required": "usernameRequired",
  "username must be at least 3 characters": "usernameMinLength",
  "username must be at most 30 characters": "usernameMaxLength",
  "username can only contain letters, numbers, and underscores":
    "usernameInvalidChars",
  "password must be at least 10 characters": "passwordMinLength",
  "password must be at most 72 characters": "passwordMaxLength",
  "password must contain at least one uppercase letter":
    "passwordNeedsUppercase",
  "password must contain at least one lowercase letter":
    "passwordNeedsLowercase",
  "password must contain at least one digit": "passwordNeedsDigit",
  "password must contain at least one special character":
    "passwordNeedsSpecial",
};

/** Error map for change password form (uses settings.security.errors namespace) */
const CHANGE_PASSWORD_ERROR_MAP: Record<string, string> = {
  "no password set for this account": "noPasswordSet",
  "current password is incorrect": "currentPasswordIncorrect",
  "new password must be different from current password":
    "newPasswordSameAsCurrent",
  "password must be at least 10 characters": "passwordMinLength",
  "password must be at most 72 characters": "passwordMaxLength",
  "password must contain at least one uppercase letter":
    "passwordNeedsUppercase",
  "password must contain at least one lowercase letter":
    "passwordNeedsLowercase",
  "password must contain at least one digit": "passwordNeedsDigit",
  "password must contain at least one special character":
    "passwordNeedsSpecial",
};

/** Error map for link Google action (uses settings.security.errors namespace) */
const LINK_GOOGLE_ERROR_MAP: Record<string, string> = {
  "google account is already linked": "googleAlreadyLinked",
  "this google account is linked to a different user": "googleEmailTaken",
  "google email does not match your account email": "googleEmailMismatch",
  "invalid google token": "invalidGoogleToken",
  "google account does not have an email": "invalidGoogleToken",
};

/** Error map for unlink Google action (uses settings.security.errors namespace) */
const UNLINK_GOOGLE_ERROR_MAP: Record<string, string> = {
  "google account is not linked": "googleNotLinked",
  "please set a password before disconnecting google":
    "disconnectRequiresPassword",
};

/**
 * Maps a server error message to an i18n key for the register form.
 * Returns the i18n key if found, or null for the fallback.
 */
export function mapRegisterError(
  serverMessage: string | undefined
): string | null {
  if (!serverMessage) return null;
  const lower = serverMessage.toLowerCase();
  return REGISTER_ERROR_MAP[lower] ?? null;
}

/**
 * Maps a server error message to an i18n key for the link password form.
 * Returns the i18n key if found, or null for the fallback.
 */
export function mapLinkPasswordError(
  serverMessage: string | undefined
): string | null {
  if (!serverMessage) return null;
  const lower = serverMessage.toLowerCase();
  return LINK_PASSWORD_ERROR_MAP[lower] ?? null;
}

/**
 * Maps a server error message to an i18n key for the change password form.
 * Returns the i18n key if found, or null for the fallback.
 */
export function mapChangePasswordError(
  serverMessage: string | undefined
): string | null {
  if (!serverMessage) return null;
  const lower = serverMessage.toLowerCase();
  return CHANGE_PASSWORD_ERROR_MAP[lower] ?? null;
}

/**
 * Maps a server error message to an i18n key for the link Google action.
 * Returns the i18n key if found, or null for the fallback.
 */
export function mapLinkGoogleError(
  serverMessage: string | undefined
): string | null {
  if (!serverMessage) return null;
  const lower = serverMessage.toLowerCase();
  return LINK_GOOGLE_ERROR_MAP[lower] ?? null;
}

/**
 * Maps a server error message to an i18n key for the unlink Google action.
 * Returns the i18n key if found, or null for the fallback.
 */
export function mapUnlinkGoogleError(
  serverMessage: string | undefined
): string | null {
  if (!serverMessage) return null;
  const lower = serverMessage.toLowerCase();
  return UNLINK_GOOGLE_ERROR_MAP[lower] ?? null;
}
