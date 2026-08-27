export const INDIAN_MOBILE_PATTERN = /^\+91[6-9]\d{9}$/;

export const INDIAN_MOBILE_MESSAGE =
  "must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9";

export function normalizeIndianMobile(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (/^[6-9]\d{9}$/.test(trimmed)) return `+91${trimmed}`;
  if (INDIAN_MOBILE_PATTERN.test(trimmed)) return trimmed;
  return trimmed;
}
