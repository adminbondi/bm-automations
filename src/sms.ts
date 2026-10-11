export const REPLY_STOP_FOOTER = "\nReply STOP";

export function withReplyStop(body: string, enabled: boolean): string {
  if (!enabled) return body;
  if (/reply stop/i.test(body)) return body;
  return `${body}${REPLY_STOP_FOOTER}`;
}

export function renderSms(template: string, firstName: string | null, studioName: string): string {
  const name = firstName?.trim() || "there";
  const studio = studioName.trim() || "Balance Moves";
  return template.replace(/\[first name\]/gi, name).replace(/\[studio\]/gi, studio);
}
