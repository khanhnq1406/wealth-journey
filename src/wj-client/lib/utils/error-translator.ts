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
 * Translates a Zod validation error message key using the 'validation' namespace.
 * Falls back to the raw message if no translation is found.
 * Use this in form components that render errors directly (not via RHF wrappers).
 */
export function translateValidationMessage(
  tValidation: (key: never) => string,
  message?: string
): string | undefined {
  if (!message) return undefined;
  try {
    return tValidation(message as never);
  } catch {
    return message;
  }
}
