export function renderSms(template: string, firstName: string | null, studioName: string): string {
  const name = firstName?.trim() || "there";
  const studio = studioName.trim() || "Balance Moves";
  return template.replace(/\[first name\]/gi, name).replace(/\[studio\]/gi, studio);
}
