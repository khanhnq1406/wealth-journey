/**
 * Maps API error codes to translated messages using next-intl.
 * Falls back to error.message if no translation exists for the code.
 * Supports interpolation params from the API error response.
 */
export function getTranslatedError(
  error: { code?: string; message: string; params?: Record<string, string> },
  t: (key: string, values?: Record<string, string>) => string
): string {
  if (!error.code) return error.message;

  try {
    const key = `errors.${error.code}`;
    const translated = t(key, error.params);
    // next-intl returns the key path if translation is not found
    if (translated && translated !== key) {
      return translated;
    }
  } catch {
    // Translation key not found — fall back
  }

  return error.message;
}

/**
 * Checks if a string looks like a translation key (UPPER_SNAKE_CASE).
 * Zod default messages like "Invalid input: expected number, received string"
 * should NOT be passed to next-intl as they will cause MISSING_MESSAGE errors.
 */
const TRANSLATION_KEY_PATTERN = /^[A-Z][A-Z0-9_]+$/;

/**
 * Translates a Zod validation error message key using the 'validation' namespace.
 * Falls back to the raw message if no translation is found.
 * Only attempts translation if the message looks like a translation key (UPPER_SNAKE_CASE).
 * Use this in form components that render errors directly (not via RHF wrappers).
 */
export function translateValidationMessage(
  tValidation: (key: never) => string,
  message?: string
): string | undefined {
  if (!message) return undefined;
  if (!TRANSLATION_KEY_PATTERN.test(message)) return message;
  try {
    return tValidation(message as never);
  } catch {
    return message;
  }
}
