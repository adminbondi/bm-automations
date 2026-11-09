export {
  INTRO,
  CLASS_PASS,
  SEEN,
  SMS,
  absent,
  anniversary,
  leadDelay,
  external,
  row,
  type Spec,
  type AuditAutomation,
} from "./coverage-seed-part1a";
import { SPECS_PART1A } from "./coverage-seed-part1a";
import { SPECS_PART1B } from "./coverage-seed-part1b";
import type { Spec } from "./coverage-seed-part1a";

export const SPECS_PART1: Spec[] = [...SPECS_PART1A, ...SPECS_PART1B];
