export const DATE_PATTERNS = ["DD/MM/AAAA", "MM/DD/AAAA", "AAAA-MM-DD"] as const;
export type DatePattern = (typeof DATE_PATTERNS)[number];
export const DEFAULT_DATE_PATTERN: DatePattern = "DD/MM/AAAA";

export function normalizeDatePattern(value: string | null | undefined): DatePattern {
  return DATE_PATTERNS.includes(value as DatePattern) ? (value as DatePattern) : DEFAULT_DATE_PATTERN;
}

function calendar(year: number, month: number, day: number) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return "";
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatIso(iso: string, pattern: DatePattern = DEFAULT_DATE_PATTERN): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match || !calendar(Number(match[1]), Number(match[2]), Number(match[3]))) return "";
  const [, year, month, day] = match;
  if (pattern === "MM/DD/AAAA") return `${month}/${day}/${year}`;
  if (pattern === "AAAA-MM-DD") return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function maskDateInput(raw: string, pattern: DatePattern = DEFAULT_DATE_PATTERN): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (pattern === "AAAA-MM-DD") return [digits.slice(0, 4), digits.slice(4, 6), digits.slice(6, 8)].filter(Boolean).join("-");
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

export function parseDateInput(text: string, pattern: DatePattern = DEFAULT_DATE_PATTERN): string {
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  if (pattern === "AAAA-MM-DD") return calendar(Number(digits.slice(0, 4)), Number(digits.slice(4, 6)), Number(digits.slice(6, 8)));
  if (pattern === "MM/DD/AAAA") return calendar(Number(digits.slice(4, 8)), Number(digits.slice(0, 2)), Number(digits.slice(2, 4)));
  return calendar(Number(digits.slice(4, 8)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)));
}
