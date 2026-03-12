/**
 * Format a Unix timestamp (seconds) into "dd/mm/yyyy HH:mm" format.
 * Falls back to current time if timestamp is invalid or zero.
 *
 * @param unixTimestamp - Unix timestamp in seconds (from API's UpdatedAt field)
 * @returns Formatted string like "12/03/2026 14:30"
 */
export function formatUpdateTimestamp(
  unixTimestamp: number | undefined,
): string {
  let date: Date;

  if (unixTimestamp && unixTimestamp > 0) {
    date = new Date(unixTimestamp * 1000);
    // Guard against invalid dates (e.g. 0001-01-01)
    if (Number.isNaN(date.getTime()) || date.getFullYear() < 2020) {
      date = new Date();
    }
  } else {
    date = new Date();
  }

  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Get the most recent UpdatedAt timestamp from a list of price items.
 */
export function getLatestTimestamp(
  items: { updatedAt?: number | string }[],
): number {
  let latest = 0;
  for (const item of items) {
    const ts =
      typeof item.updatedAt === "string"
        ? Number(item.updatedAt)
        : (item.updatedAt ?? 0);
    if (ts > latest) {
      latest = ts;
    }
  }
  return latest;
}
