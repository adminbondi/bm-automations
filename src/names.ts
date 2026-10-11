export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

export function nameMatchesTokens(name: string, tokens: string[]): boolean {
  if (!name || tokens.length === 0) return false;
  const normalized = normalizeName(name);
  return tokens.some((token) => {
    const needle = normalizeName(token);
    return needle.length > 0 && normalized.includes(needle);
  });
}

export function contractMatches(name: string, list: string[]): boolean {
  if (!name || list.length === 0) return false;
  const normalized = normalizeName(name);
  return list.some((item) => normalizeName(item) === normalized);
}
