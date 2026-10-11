export const TIMING_KINDS = [
  "immediate",
  "delay_days",
  "days_before_expiry",
  "days_after_expiry",
  "days_since_last_visit",
  "birthday_day",
  "birthday_month_start",
] as const;
export type TimingKind = (typeof TIMING_KINDS)[number];

export const CHANNELS = ["email", "sms"] as const;
export type Channel = (typeof CHANNELS)[number];

export type VisitCountMode = "signed_in" | "booked";
export type VisitCountScope = "all" | "intro_pass" | "matching_package";

export type ClientActivity = "active" | "inactive";
export type DedupeScope = "client" | "visit_milestone" | "calendar_year";

export type AutomationFilters = {
  packageNameIncludes?: string[];
  contractNames?: string[];
  signedInStatus?: string;
  visitCountMode?: VisitCountMode;
  includeClassPassVisits?: boolean;
  classPassNameIncludes?: string[];
  minRemaining?: number;
  maxRemaining?: number;
  exactRemaining?: number;
  clientActivity?: ClientActivity;
};

export type AutomationSkipRules = {
  skipIfAlreadySent?: boolean;
  skipIfHasIntroOrAnyPurchase?: boolean;
  skipIfHasVisited?: boolean;
  skipIfHasAnyPurchase?: boolean;
  skipIfUnsubscribed?: boolean;
  skipIfMembership?: boolean;
  membershipContractNames?: string[];
  skipIfHasBooking?: boolean;
  minVisits?: number;
  exactVisits?: number;
  maxVisits?: number;
  everyNthVisit?: number;
  visitWindowDays?: number;
  minVisitsInWindow?: number;
  maxVisitsInWindow?: number;
  visitCountScope?: VisitCountScope;
  skipIfPassExpired?: boolean;
  skipIfWaiverSigned?: boolean;
  includeVisitsInData?: boolean;
  dedupeScope?: DedupeScope;
  repeat?: "yearly";
};

export type Automation = {
  id: number;
  key: string;
  name: string;
  channel: Channel;
  templateId: number | null;
  messageText: string | null;
  triggerEvents: string[];
  scheduleOnEvents: string[];
  timingKind: TimingKind;
  timingOffsetDays: number | null;
  filters: AutomationFilters;
  skipRules: AutomationSkipRules;
  enabled: boolean;
  extraRecipient: string | null;
  notes: string | null;
};

export type Visit = {
  id: number;
  signedIn: boolean;
  lateCancelled: boolean;
  earlyCancelled: boolean;
  serviceName: string;
  startSydney?: string | null;
};

export type ServiceRecord = {
  name: string;
  expirationSydney: string | null;
  current: boolean;
  remaining?: number | null;
  productId?: number | null;
};

export type ContractRecord = {
  name: string;
};

export type JobPayload = {
  visitCrossing?: boolean;
  windowAlreadyMatched?: boolean;
  signedInStatus?: string | null;
  packageNames?: string[];
  contractName?: string | null;
};

export type ScheduledJob = {
  id: number;
  automationId: number;
  clientId: string;
  templateId: number | null;
  dueOn: string;
  status: string;
  reason: string | null;
  payload: JobPayload;
  createdAt: string;
  updatedAt: string;
};

export type SendLogRow = {
  id: number;
  dedupeKey: string;
  automationId: number;
  clientId: string;
  channel: Channel;
  templateId: number | null;
  email: string | null;
  phone: string | null;
  status: string;
  detail: string | null;
  createdAt: string;
};
