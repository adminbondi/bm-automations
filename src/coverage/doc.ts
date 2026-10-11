import { ORIGINAL_AUDIT, SEEDED_AUDIT, type AuditAutomation } from "../automations/coverage-seed";
import { DYNAMIC_LISTS, LANES, STATIC_LISTS, type SegmentRow } from "../segments/catalog";

export type CoverageCounts = {
  automationsCovered: number;
  automationsGap: number;
  lanesCovered: number;
  lanesGap: number;
  dynamicCovered: number;
  dynamicGap: number;
  staticCovered: number;
  staticGap: number;
};

export function automationAudit(): AuditAutomation[] {
  const rows = [...ORIGINAL_AUDIT, ...SEEDED_AUDIT];
  return rows.sort((left, right) => left.funnel.localeCompare(right.funnel) || left.name.localeCompare(right.name));
}

export function coverageCounts(): CoverageCounts {
  const automations = [...ORIGINAL_AUDIT, ...SEEDED_AUDIT];
  return {
    automationsCovered: automations.filter((row) => row.status === "covered").length,
    automationsGap: automations.filter((row) => row.status === "gap").length,
    lanesCovered: LANES.filter((row) => row.status === "covered").length,
    lanesGap: LANES.filter((row) => row.status === "gap").length,
    dynamicCovered: DYNAMIC_LISTS.filter((row) => row.status === "covered").length,
    dynamicGap: DYNAMIC_LISTS.filter((row) => row.status === "gap").length,
    staticCovered: STATIC_LISTS.filter((row) => row.status === "covered").length,
    staticGap: STATIC_LISTS.filter((row) => row.status === "gap").length,
  };
}

function cell(value: string): string {
  return value.replaceAll("|", "/").replaceAll("\n", " ");
}

function automationTable(rows: AuditAutomation[]): string {
  const header = "| Funnel | Name | LoyalSnap | Trigger | Filters | Delay | Stop rules | Result |";
  const rule = "| --- | --- | --- | --- | --- | --- | --- | --- |";
  const body = rows.map((row) => {
    const result = row.status === "covered" ? `covered — ${row.detail}` : `gap — ${row.detail}`;
    return `| ${cell(row.funnel)} | ${cell(row.name)} | ${row.loyalSnap} | ${cell(row.trigger)} | ${cell(row.filters)} | ${cell(row.delay)} | ${cell(row.stop)} | ${cell(result)} |`;
  });
  return [header, rule, ...body].join("\n");
}

function segmentTable(rows: SegmentRow[]): string {
  const header = "| Kind | Name | LoyalSnap | Trigger | Filters | Delay | Stop rules | Result |";
  const rule = "| --- | --- | --- | --- | --- | --- | --- | --- |";
  const body = rows.map((row) => {
    const result = row.status === "covered" ? `covered — ${row.detail}` : `gap — ${row.detail}`;
    return `| ${row.kind} | ${cell(row.name)} | ${cell(row.loyalSnap)} | ${cell(row.trigger)} | ${cell(row.filters)} | ${cell(row.delay)} | ${cell(row.stop)} | ${cell(result)} |`;
  });
  return [header, rule, ...body].join("\n");
}

export function renderCoverage(): string {
  const counts = coverageCounts();
  const automations = automationAudit();
  return `# LoyalSnap coverage

Captured 11 Oct 2026 from the LoyalSnap inventory (9 funnels, 71 automations, 19 dashboard lanes, dynamic client lists, and the static client-list titles). Every automation below is a row in D1. Rows that were off in LoyalSnap are seeded with enabled = false.

## Summary

| Set | Covered | Gap |
| --- | ---: | ---: |
| Automations (71) | ${counts.automationsCovered} | ${counts.automationsGap} |
| Dashboard lanes (19) | ${counts.lanesCovered} | ${counts.lanesGap} |
| Dynamic client lists (13) | ${counts.dynamicCovered} | ${counts.dynamicGap} |
| Static client lists (${STATIC_LISTS.length}) | ${counts.staticCovered} | ${counts.staticGap} |

Covered means the engine can express the rule and, for automations, a disabled D1 row exists. Gap means a fact or threshold was not in the export, so the row is not pretended to match.

Emails that have no listmonk template id stay with template_id null. Turning one on holds the job with reason template_missing and does not call listmonk. Package and contract names that were not in the export use an empty list, which matches nothing until an owner saves the names.

## Automations

${automationTable(automations)}

## Dashboard lanes

These are staff call, text, and email scripts on the task dashboard. They are not sends. The audience is a saved segment filter in \`src/segments/catalog.ts\`. Tasks in the sidebar still opens the task dashboard.

${segmentTable(LANES)}

## Dynamic client lists

${segmentTable(DYNAMIC_LISTS)}

## Static client lists

${segmentTable(STATIC_LISTS)}
`;
}
