export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  let compact = value.trim().replace(/[^\d+]/g, "");
  if (!compact) return null;
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digits = compact.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `+${digits}`;
  return `+${digits}`;
}
