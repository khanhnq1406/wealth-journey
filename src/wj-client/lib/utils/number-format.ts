/**
 * Format number with thousand separators (commas)
 * @param value - The number to format
 * @returns Formatted string with commas (e.g., "1,000")
 */
export function formatNumberWithCommas(value: number | string): string {
  // Handle empty or invalid input
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  // Convert to string and remove existing commas
  const stringValue = String(value).replace(/,/g, "");

  // Handle invalid numeric strings
  if (isNaN(Number(stringValue))) {
    return "";
  }

  // Handle negative sign
  const isNegative = stringValue.startsWith("-");
  const absoluteValue = isNegative ? stringValue.slice(1) : stringValue;

  // Handle decimal numbers
  const parts = absoluteValue.split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];

  // Add thousand separators to integer part
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Reconstruct with decimal if present
  const formattedValue =
    decimalPart !== undefined
      ? `${formattedInteger}.${decimalPart}`
      : formattedInteger;

  // Add negative sign back if needed
  return isNegative ? `-${formattedValue}` : formattedValue;
}

/**
 * Remove thousand separators from formatted string
 * @param value - The formatted string with commas
 * @returns Clean numeric string
 */
export function parseNumberWithCommas(value: string): string {
  return value.replace(/,/g, "");
}

/**
 * Check if a string represents a valid numeric value (allowing commas)
 * @param value - The string to validate
 * @returns True if valid number format
 */
export function isValidNumberInput(value: string): boolean {
  // Allow: digits, commas, single decimal point, leading minus
  const regex = /^-?\d{1,3}(,\d{3})*(\.\d*)?$|^-?\d+(\.\d*)?$/;
  return regex.test(value);
}

/**
 * Normalize decimal input by converting comma to dot when the comma
 * is used as a decimal separator (common on Vietnamese locale keyboards).
 *
 * Heuristic: A comma is treated as a thousand separator if it is followed
 * by exactly 3 digits (and possibly more ",NNN" groups) until end-of-string.
 * Otherwise it is treated as a decimal separator and converted to a dot.
 *
 * If the string already contains a dot, commas are left as-is (they must
 * be thousand separators).
 */
export function normalizeDecimalInput(value: string): string {
  if (!value) return value;

  // If there's already a dot, commas are thousand separators — leave as-is
  if (value.includes(".")) return value;

  // If there's no comma, nothing to do
  if (!value.includes(",")) return value;

  // If the entire string matches a thousand-separated pattern, leave as-is
  if (/^-?\d{1,3}(,\d{3})*$/.test(value)) {
    return value;
  }

  // Otherwise, treat the last comma as a decimal separator
  const lastCommaIndex = value.lastIndexOf(",");
  const beforeLastComma = value.substring(0, lastCommaIndex);
  const afterComma = value.substring(lastCommaIndex + 1);
  return beforeLastComma + "." + afterComma;
}
