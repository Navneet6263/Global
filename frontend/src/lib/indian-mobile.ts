export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;

export function indianMobileDigits(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  const national = digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits;
  return national.slice(0, 10);
}

export function isValidIndianMobile(value: string | null | undefined): boolean {
  return INDIAN_MOBILE_PATTERN.test(indianMobileDigits(value));
}

export function toIndianMobileE164(value: string | null | undefined): string | undefined {
  const digits = indianMobileDigits(value);
  return digits ? `+91${digits}` : undefined;
}
