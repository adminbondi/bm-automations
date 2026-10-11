/** listmonk template subjects. The worker does not write these back to listmonk. */
export const TEMPLATE_SUBJECTS: Record<number, string> = {
  5: "Welcome aboard — we’ve saved your spot!",
  6: "{{ .Subscriber.FirstName }}, keep health and fitness a top priority",
  7: "Welcome to Balance Moves! Your Intro Pass is ready!",
  8: "Congrats, {{ .Subscriber.FirstName }}! You're on a roll!",
  9: "{{ .Subscriber.FirstName }}, your Intro Pass ends in 3 days!",
  10: "{{ .Subscriber.FirstName }}, your Intro Pass ends tomorrow!",
  11: "Thanks for starting your membership!",
  12: "{{ .Subscriber.FirstName }}, Share The Love!",
  13: "Welcome to Balance Moves - WAIVER SIGNATURE & What to expect",
};

export function templateLabel(templateId: number | null): string {
  if (templateId === null) return "No template";
  const subject = TEMPLATE_SUBJECTS[templateId];
  return subject ? `Template ${templateId} · ${subject}` : `Template ${templateId}`;
}
