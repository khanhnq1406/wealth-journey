import {
  formatNumberWithCommas,
  parseNumberWithCommas,
  isValidNumberInput,
  normalizeDecimalInput,
} from "./number-format";

describe("formatNumberWithCommas", () => {
  test("formats basic thousands", () => {
    expect(formatNumberWithCommas(1000)).toBe("1,000");
    expect(formatNumberWithCommas(10000)).toBe("10,000");
    expect(formatNumberWithCommas(100000)).toBe("100,000");
  });

  test("formats millions with decimals", () => {
    expect(formatNumberWithCommas(1000000.5)).toBe("1,000,000.5");
    expect(formatNumberWithCommas(1000000.5)).toBe("1,000,000.5");
  });

  test("formats string inputs", () => {
    expect(formatNumberWithCommas("1000")).toBe("1,000");
    expect(formatNumberWithCommas("10000.50")).toBe("10,000.50");
  });

  test("handles negative numbers", () => {
    expect(formatNumberWithCommas(-1000)).toBe("-1,000");
    expect(formatNumberWithCommas("-10000.50")).toBe("-10,000.50");
  });

  test("handles already formatted numbers", () => {
    expect(formatNumberWithCommas("1,000")).toBe("1,000");
    expect(formatNumberWithCommas("10,000.50")).toBe("10,000.50");
  });

  test("handles edge cases", () => {
    expect(formatNumberWithCommas(0)).toBe("0");
    expect(formatNumberWithCommas("")).toBe("");
    expect(formatNumberWithCommas(100)).toBe("100");
    expect(formatNumberWithCommas(999)).toBe("999");
  });

  test("handles invalid inputs", () => {
    expect(formatNumberWithCommas(null as any)).toBe("");
    expect(formatNumberWithCommas(undefined as any)).toBe("");
    expect(formatNumberWithCommas("abc")).toBe("");
  });

  test("preserves decimal precision", () => {
    expect(formatNumberWithCommas("1000.123456")).toBe("1,000.123456");
    expect(formatNumberWithCommas("1000.00")).toBe("1,000.00");
  });
});

describe("parseNumberWithCommas", () => {
  test("removes commas from formatted numbers", () => {
    expect(parseNumberWithCommas("1,000")).toBe("1000");
    expect(parseNumberWithCommas("10,000.50")).toBe("10000.50");
    expect(parseNumberWithCommas("1,000,000")).toBe("1000000");
  });

  test("handles unformatted numbers", () => {
    expect(parseNumberWithCommas("1000")).toBe("1000");
    expect(parseNumberWithCommas("123.45")).toBe("123.45");
  });

  test("handles negative numbers", () => {
    expect(parseNumberWithCommas("-1,000")).toBe("-1000");
    expect(parseNumberWithCommas("-10,000.50")).toBe("-10000.50");
  });
});

describe("isValidNumberInput", () => {
  test("validates correctly formatted numbers", () => {
    expect(isValidNumberInput("1,000")).toBe(true);
    expect(isValidNumberInput("10,000")).toBe(true);
    expect(isValidNumberInput("100,000.50")).toBe(true);
    expect(isValidNumberInput("1000")).toBe(true);
    expect(isValidNumberInput("123.45")).toBe(true);
  });

  test("validates negative numbers", () => {
    expect(isValidNumberInput("-1,000")).toBe(true);
    expect(isValidNumberInput("-100")).toBe(true);
    expect(isValidNumberInput("-123.45")).toBe(true);
  });

  test("validates partial decimal input", () => {
    expect(isValidNumberInput("100.")).toBe(true);
    expect(isValidNumberInput("1,000.")).toBe(true);
  });

  test("rejects invalid formats", () => {
    expect(isValidNumberInput("abc")).toBe(false);
    expect(isValidNumberInput("1,00")).toBe(false); // Invalid comma placement
    expect(isValidNumberInput("1,,000")).toBe(false); // Double comma
    expect(isValidNumberInput("1.000.50")).toBe(false); // Multiple decimals
    expect(isValidNumberInput("")).toBe(false);
  });
});

describe("normalizeDecimalInput", () => {
  test("converts comma to dot for decimal input", () => {
    expect(normalizeDecimalInput("1000,50")).toBe("1000.50");
    expect(normalizeDecimalInput("100,5")).toBe("100.5");
  });

  test("leaves dot-based input unchanged", () => {
    expect(normalizeDecimalInput("1000.50")).toBe("1000.50");
    expect(normalizeDecimalInput("100")).toBe("100");
  });

  test("does not convert comma that looks like thousand separator", () => {
    // Comma followed by exactly 3 digits at end = thousand separator
    expect(normalizeDecimalInput("1,000")).toBe("1,000");
    expect(normalizeDecimalInput("10,000")).toBe("10,000");
    expect(normalizeDecimalInput("1,000,000")).toBe("1,000,000");
  });

  test("converts comma that does NOT look like thousand separator", () => {
    // Comma NOT followed by exactly 3 digits = decimal separator
    expect(normalizeDecimalInput("1000,5")).toBe("1000.5");
    expect(normalizeDecimalInput("1000,50")).toBe("1000.50");
    expect(normalizeDecimalInput("1000,1234")).toBe("1000.1234");
    expect(normalizeDecimalInput("0,5")).toBe("0.5");
  });

  test("handles input that already has a dot", () => {
    // If there's already a dot, don't convert commas (they're thousand seps)
    expect(normalizeDecimalInput("1,000.50")).toBe("1,000.50");
  });

  test("handles edge cases", () => {
    expect(normalizeDecimalInput("")).toBe("");
    expect(normalizeDecimalInput("0")).toBe("0");
    expect(normalizeDecimalInput("-1000,5")).toBe("-1000.5");
    expect(normalizeDecimalInput(",5")).toBe(".5");
  });

  test("handles trailing comma", () => {
    // Trailing comma = user starting to type decimal
    expect(normalizeDecimalInput("1000,")).toBe("1000.");
  });
});
