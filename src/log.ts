export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ service: "bm-automations", ...fields }));
}
