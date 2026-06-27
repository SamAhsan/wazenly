export function normalizePhone(phone: string): string {
  // Strip all non-digits except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  // E.164: + followed by 7–15 digits
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  return normalized;
}
