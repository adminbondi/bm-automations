export const CONTACT_WRITE_MODES = ["shared_sync", "self"] as const;
export type ContactWriteMode = (typeof CONTACT_WRITE_MODES)[number];

export function parseContactWriteMode(value: string | undefined): ContactWriteMode {
  return value?.trim() === "self" ? "self" : "shared_sync";
}

export function mayWriteSubscriber(input: {
  mode: ContactWriteMode;
  devMode: boolean;
  email: string;
  emailAllowlist: string[];
}): boolean {
  if (input.mode !== "self" || !input.devMode) return false;
  return input.emailAllowlist.includes(input.email.trim().toLowerCase());
}
