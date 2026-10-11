import { MERGE_FIELDS } from "../merge/fields";

const PER_SEND = new Set([
  "pack_name",
  "pass_end_date",
  "visits",
  "credits_remaining",
  "days_since_expiry",
  "days_since_last_visit",
]);

export function renderSyncContract(): string {
  const written = MERGE_FIELDS.filter((field) => field.attrib);
  const txOnly = MERGE_FIELDS.filter((field) => !field.attrib);
  const header = "| listmonk key | Mindbody source | Example | Who fills it |";
  const rule = "| --- | --- | --- | --- |";
  const rows = written.map((field) => {
    const source = field.gap ? "gap" : field.mindbody;
    const who = PER_SEND.has(field.attrib)
      ? "Shared sync writes attribs." + field.attrib + ". This worker also sends the live value in Tx.Data."
      : "Shared sync writes attribs." + field.attrib + ".";
    return `| ${cell(`attribs.${field.attrib}`)} | ${cell(source)} | ${cell(field.example || "empty")} | ${cell(who)} |`;
  });
  const txRows = txOnly.map((field) => `| ${cell(field.syntax)} | ${cell("gap")} | ${cell(field.example || "empty")} | This worker, on each send. Not a subscriber attribute. |`);
  return `# Listmonk contact sync

The shared Mindbody contact sync is the only writer of listmonk subscribers. It is the same sync that feeds Chatwoot. This worker looks up a subscriber by email and sends the message. It does not create or update subscribers while \`CONTACT_WRITE_MODE\` is \`shared_sync\`, which is the default.

If listmonk has no subscriber for that email, the email is not sent. The worker logs \`send_skipped\` with reason \`subscriber_missing\` and records the send log as \`skipped_no_subscriber\`.

\`CONTACT_WRITE_MODE=self\` is for dev and test. A write runs only when \`DEV_MODE\` is true and the address is on \`SEND_ALLOWLIST\`. Any other address is read the same way as \`shared_sync\`. A \`self\` write creates the subscriber when missing and updates \`attribs\` when the row already exists. A copy recipient is created without replacing that inbox's attributes.

## What the shared sync must write

Set the listmonk subscriber \`name\` to the Mindbody first and last name, separated by a space. \`{{ .Subscriber.FirstName }}\` and \`{{ .Subscriber.LastName }}\` come from that name. \`attribs.first_name\` is the Mindbody first name, including blank. Do not store the SMS fallback "there" on the subscriber.

Write every key below. Values that change between sends are also placed in \`POST /api/tx\` \`data\` by this worker, so a template can use \`{{ .Tx.Data.passEndDate }}\` even when the stored attribute is older.

${[header, rule, ...rows].join("\n")}

## Sent in Tx.Data, not stored by the sync

${["| Template field | Mindbody source | Example | Who fills it |", rule, ...txRows].join("\n")}

\`preferencesUrl\` is the same address as \`unsubscribeUrl\`. Studio name, phone, and address are gaps in Mindbody. Write the examples above: Balance Moves, 0424 133 544, and 72A-74 Hall Street, Bondi Beach, NSW, 2026.
`;
}

function cell(value: string): string {
  return value.replaceAll("|", "&#124;");
}
