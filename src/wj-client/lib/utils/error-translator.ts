/**
 * Maps API error codes to translated messages using next-intl.
 * Falls back to error.message if no translation exists for the code.
 */
export function getTranslatedError(
  error: { code?: string; message: string },
  t: (key: string) => string
): string {
  if (!error.code) return error.message;

  try {
    const key = `errors.${error.code}`;
    const translated = t(key);
    // next-intl returns the key path if translation is not found
    if (translated && translated !== key) {
      return translated;
    }
  } catch {
    // Translation key not found — fall back
  }

  return error.message;
}
