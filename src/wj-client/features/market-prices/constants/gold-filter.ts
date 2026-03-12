/**
 * Gold price table filter configuration.
 * Defines the 9 gold types to show in price tables, their display order,
 * and display name overrides.
 *
 * `apiName` is the exact Name field from the API response used for matching.
 * `displayName` is the user-facing label shown in the table.
 */
export const GOLD_TABLE_FILTER: {
  apiName: string;
  displayName: string;
}[] = [
  { apiName: "SJC", displayName: "SJC" },
  { apiName: "SJC TD", displayName: "SJC Tự Do" },
  { apiName: "Vàng nhẫn SJC", displayName: "Nhẫn SJC 9999" },
  { apiName: "Doji_24K", displayName: "Nhẫn Doji 9999" },
  { apiName: "Mi hồng", displayName: "SJC Mi Hồng" },
  { apiName: "Mihong_999", displayName: "Nhẫn Mi Hồng 9999" },
  { apiName: "BTMC", displayName: "SJC BTMC" },
  { apiName: "BTMC_24K", displayName: "Nhẫn BTMC" },
  { apiName: "PNJ HCM", displayName: "PNJ" },
];

/**
 * Filter and reorder gold prices to show only the configured types.
 * Matches by typeCode (which corresponds to API Name field).
 * Missing types are silently skipped (graceful degradation).
 */
export function filterGoldPrices<
  T extends { typeCode?: string; name?: string },
>(prices: T[]): (T & { displayName: string })[] {
  const result: (T & { displayName: string })[] = [];

  for (const filter of GOLD_TABLE_FILTER) {
    const match = prices.find(
      (p) => p.typeCode === filter.apiName || p.name === filter.apiName,
    );
    if (match) {
      result.push({ ...match, displayName: filter.displayName });
    }
  }

  return result;
}
