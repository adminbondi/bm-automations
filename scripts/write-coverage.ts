import { writeFileSync } from "node:fs";
import { COVERAGE_AUTOMATIONS } from "../src/automations/coverage-seed";
import { seedInsertSql } from "../src/automations/seed";
import { renderCoverage } from "../src/coverage/doc";

writeFileSync("COVERAGE.md", renderCoverage());
const sql = [
  "-- LoyalSnap automations that were off. All rows are disabled.",
  "-- Emails without a listmonk template id stay null and the engine holds them as template_missing.",
  ...COVERAGE_AUTOMATIONS.map((row) => seedInsertSql(row)),
].join("\n\n") + "\n";
writeFileSync("migrations/0004_coverage.sql", sql);
console.log(`wrote ${COVERAGE_AUTOMATIONS.length} rows`);
