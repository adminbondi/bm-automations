import type {
  Automation,
  AutomationFilters,
  AutomationSkipRules,
  Channel,
  JobPayload,
  ScheduledJob,
  SendLogRow,
  TimingKind,
} from "../automations/types";
import { SEED_AUTOMATIONS, SEED_CREATED_AT } from "../automations/seed";

export interface Stmt {
  bind(...values: unknown[]): Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<T[]>;
  run(): Promise<{ changes: number }>;
}

export interface Db {
  prepare(sql: string): Stmt;
}

type AutomationRow = {
  id: number;
  key: string;
  name: string;
  channel: string | null;
  template_id: number | null;
  message_text: string | null;
  trigger_events_json: string;
  schedule_on_events_json: string;
  timing_kind: TimingKind;
  timing_offset_days: number | null;
  filters_json: string;
  skip_rules_json: string;
  enabled: number;
  extra_recipient: string | null;
  notes: string | null;
};

const AUTOMATION_INSERT = `INSERT OR IGNORE INTO automations (
  id, key, name, channel, template_id, message_text, trigger_events_json, schedule_on_events_json,
  timing_kind, timing_offset_days, filters_json, skip_rules_json, enabled,
  extra_recipient, notes, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function rowToAutomation(row: AutomationRow): Automation {
  const channel: Channel = row.channel === "sms" ? "sms" : "email";
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    channel,
    templateId: row.template_id,
    messageText: row.message_text,
    triggerEvents: parseJson<string[]>(row.trigger_events_json, []),
    scheduleOnEvents: parseJson<string[]>(row.schedule_on_events_json, []),
    timingKind: row.timing_kind,
    timingOffsetDays: row.timing_offset_days,
    filters: parseJson<AutomationFilters>(row.filters_json, {}),
    skipRules: parseJson<AutomationSkipRules>(row.skip_rules_json, {}),
    enabled: row.enabled === 1,
    extraRecipient: row.extra_recipient,
    notes: row.notes,
  };
}

function automationValues(automation: Automation, createdAt: string, updatedAt: string): unknown[] {
  return [
    automation.id,
    automation.key,
    automation.name,
    automation.channel,
    automation.templateId,
    automation.messageText,
    JSON.stringify(automation.triggerEvents),
    JSON.stringify(automation.scheduleOnEvents),
    automation.timingKind,
    automation.timingOffsetDays,
    JSON.stringify(automation.filters),
    JSON.stringify(automation.skipRules),
    automation.enabled ? 1 : 0,
    automation.extraRecipient,
    automation.notes,
    createdAt,
    updatedAt,
  ];
}

function isConstraint(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /unique|constraint/i.test(message);
}

export type ClientRow = {
  clientId: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string;
};

export class Repo {
  constructor(
    private readonly db: Db,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async ensureSeed(): Promise<void> {
    for (const automation of SEED_AUTOMATIONS) {
      await this.db.prepare(AUTOMATION_INSERT).bind(...automationValues(automation, SEED_CREATED_AT, SEED_CREATED_AT)).run();
    }
  }

  async listAutomations(): Promise<Automation[]> {
    const rows = await this.db.prepare(`SELECT * FROM automations ORDER BY id`).all<AutomationRow>();
    return rows.map(rowToAutomation);
  }

  async getAutomation(id: number): Promise<Automation | null> {
    const row = await this.db.prepare(`SELECT * FROM automations WHERE id = ?`).bind(id).first<AutomationRow>();
    return row ? rowToAutomation(row) : null;
  }

  async createAutomation(automation: Automation): Promise<Automation> {
    const at = this.now();
    await this.db
      .prepare(
        AUTOMATION_INSERT.replace("INSERT OR IGNORE", "INSERT"),
      )
      .bind(...automationValues(automation, at, at))
      .run();
    const created = await this.getAutomation(automation.id);
    if (!created) throw new Error("automation insert did not persist");
    return created;
  }

  async nextAutomationId(): Promise<number> {
    const row = await this.db.prepare(`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM automations`).first<{ id: number }>();
    return row?.id ?? 1;
  }

  async updateAutomation(id: number, patch: Partial<Automation>): Promise<Automation | null> {
    const current = await this.getAutomation(id);
    if (!current) return null;
    const next: Automation = {
      ...current,
      ...patch,
      id: current.id,
      filters: patch.filters ?? current.filters,
      skipRules: patch.skipRules ?? current.skipRules,
      triggerEvents: patch.triggerEvents ?? current.triggerEvents,
      scheduleOnEvents: patch.scheduleOnEvents ?? current.scheduleOnEvents,
    };
    await this.db
      .prepare(
        `UPDATE automations SET
          key = ?, name = ?, channel = ?, template_id = ?, message_text = ?, trigger_events_json = ?,
          schedule_on_events_json = ?, timing_kind = ?, timing_offset_days = ?, filters_json = ?,
          skip_rules_json = ?, enabled = ?, extra_recipient = ?, notes = ?, updated_at = ?
        WHERE id = ?`,
      )
      .bind(
        next.key,
        next.name,
        next.channel,
        next.templateId,
        next.messageText,
        JSON.stringify(next.triggerEvents),
        JSON.stringify(next.scheduleOnEvents),
        next.timingKind,
        next.timingOffsetDays,
        JSON.stringify(next.filters),
        JSON.stringify(next.skipRules),
        next.enabled ? 1 : 0,
        next.extraRecipient,
        next.notes,
        this.now(),
        id,
      )
      .run();
    return this.getAutomation(id);
  }

  async toggleAutomation(id: number): Promise<Automation | null> {
    const current = await this.getAutomation(id);
    if (!current) return null;
    return this.updateAutomation(id, { enabled: !current.enabled });
  }

  async upsertClient(input: {
    clientId: string;
    email: string | null;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO clients_seen (client_id, email, phone, first_name, last_name, created_at, first_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(client_id) DO UPDATE SET
           email = COALESCE(excluded.email, clients_seen.email),
           phone = COALESCE(excluded.phone, clients_seen.phone),
           first_name = COALESCE(excluded.first_name, clients_seen.first_name),
           last_name = COALESCE(excluded.last_name, clients_seen.last_name)`,
      )
      .bind(input.clientId, input.email, input.phone, input.firstName, input.lastName, input.createdAt, this.now())
      .run();
  }

  async getClient(clientId: string): Promise<ClientRow | null> {
    const row = await this.db
      .prepare(`SELECT client_id, email, phone, first_name, last_name, created_at FROM clients_seen WHERE client_id = ?`)
      .bind(clientId)
      .first<{
        client_id: string;
        email: string | null;
        phone: string | null;
        first_name: string | null;
        last_name: string | null;
        created_at: string;
      }>();
    if (!row) return null;
    return {
      clientId: row.client_id,
      email: row.email,
      phone: row.phone,
      firstName: row.first_name,
      lastName: row.last_name,
      createdAt: row.created_at,
    };
  }

  async enqueueJob(input: {
    automationId: number;
    clientId: string;
    templateId: number | null;
    dueOn: string;
    payload: JobPayload;
    reason?: string | null;
  }): Promise<"inserted" | "exists"> {
    const at = this.now();
    const result = await this.db
      .prepare(
        `INSERT OR IGNORE INTO scheduled_jobs (
          automation_id, client_id, template_id, due_on, status, reason, payload_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .bind(input.automationId, input.clientId, input.templateId, input.dueOn, input.reason ?? null, JSON.stringify(input.payload), at, at)
      .run();
    return result.changes > 0 ? "inserted" : "exists";
  }

  async dueJobs(todaySydney: string): Promise<ScheduledJob[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM scheduled_jobs WHERE status = 'pending' AND due_on <= ? ORDER BY due_on, id LIMIT 40`)
      .bind(todaySydney)
      .all<{
        id: number;
        automation_id: number;
        client_id: string;
        template_id: number | null;
        due_on: string;
        status: string;
        reason: string | null;
        payload_json: string | null;
        created_at: string;
        updated_at: string;
      }>();
    return rows.map((row) => ({
      id: row.id,
      automationId: row.automation_id,
      clientId: row.client_id,
      templateId: row.template_id,
      dueOn: row.due_on,
      status: row.status,
      reason: row.reason,
      payload: parseJson<JobPayload>(row.payload_json ?? "{}", {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async updateJob(id: number, input: { status?: string; reason?: string | null; payload?: JobPayload }): Promise<void> {
    const current = await this.db
      .prepare(`SELECT status, reason, payload_json FROM scheduled_jobs WHERE id = ?`)
      .bind(id)
      .first<{ status: string; reason: string | null; payload_json: string | null }>();
    if (!current) return;
    await this.db
      .prepare(`UPDATE scheduled_jobs SET status = ?, reason = ?, payload_json = ?, updated_at = ? WHERE id = ?`)
      .bind(
        input.status ?? current.status,
        input.reason === undefined ? current.reason : input.reason,
        input.payload ? JSON.stringify(input.payload) : current.payload_json,
        this.now(),
        id,
      )
      .run();
  }

  async seenMessage(messageId: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT message_id FROM webhook_events WHERE message_id = ?`).bind(messageId).first();
    return Boolean(row);
  }

  async recordMessage(messageId: string, eventId: string): Promise<void> {
    await this.db
      .prepare(`INSERT OR IGNORE INTO webhook_events (message_id, event_id, received_at) VALUES (?, ?, ?)`)
      .bind(messageId, eventId, this.now())
      .run();
  }

  async hasSent(dedupeKey: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT 1 AS ok FROM send_log WHERE dedupe_key = ? AND status = 'sent' LIMIT 1`)
      .bind(dedupeKey)
      .first();
    return Boolean(row);
  }

  async sentKeys(clientId: string): Promise<Set<string>> {
    const rows = await this.db
      .prepare(`SELECT dedupe_key FROM send_log WHERE client_id = ? AND status = 'sent'`)
      .bind(clientId)
      .all<{ dedupe_key: string }>();
    return new Set(rows.map((row) => row.dedupe_key));
  }

  async recordSend(input: {
    dedupeKey: string;
    automationId: number;
    clientId: string;
    channel: Channel;
    templateId: number | null;
    email: string | null;
    phone: string | null;
    status: string;
    detail: string | null;
  }): Promise<"inserted" | "duplicate"> {
    try {
      await this.db
        .prepare(
          `INSERT INTO send_log (
            dedupe_key, automation_id, client_id, channel, template_id, email, phone, status, detail, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.dedupeKey,
          input.automationId,
          input.clientId,
          input.channel,
          input.templateId,
          input.email,
          input.phone,
          input.status,
          input.detail,
          this.now(),
        )
        .run();
      return "inserted";
    } catch (error) {
      if (isConstraint(error)) return "duplicate";
      throw error;
    }
  }

  async listSendLog(limit: number, automationId: number | null): Promise<SendLogRow[]> {
    const capped = Math.min(Math.max(limit, 1), 200);
    const rows = automationId === null
      ? await this.db.prepare(`SELECT * FROM send_log ORDER BY id DESC LIMIT ?`).bind(capped).all<SendLogDbRow>()
      : await this.db
          .prepare(`SELECT * FROM send_log WHERE automation_id = ? ORDER BY id DESC LIMIT ?`)
          .bind(automationId, capped)
          .all<SendLogDbRow>();
    return rows.map(mapSendLog);
  }

  async isSuppressed(email: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT email FROM suppressed WHERE email = ?`).bind(email.trim().toLowerCase()).first();
    return Boolean(row);
  }

  async listSettings(): Promise<{ key: string; value: string; secret: boolean }[]> {
    const rows = await this.db.prepare(`SELECT key, value, secret FROM settings`).all<{ key: string; value: string; secret: number }>();
    return rows.map((row) => ({ key: row.key, value: row.value, secret: row.secret === 1 }));
  }

  async putSetting(key: string, value: string, secret: boolean): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO settings (key, value, secret, updated_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, secret = excluded.secret, updated_at = excluded.updated_at`,
      )
      .bind(key, value, secret ? 1 : 0, this.now())
      .run();
  }

  async deleteSetting(key: string): Promise<void> {
    await this.db.prepare(`DELETE FROM settings WHERE key = ?`).bind(key).run();
  }
}

type SendLogDbRow = {
  id: number;
  dedupe_key: string;
  automation_id: number;
  client_id: string;
  channel: string | null;
  template_id: number | null;
  email: string | null;
  phone: string | null;
  status: string;
  detail: string | null;
  created_at: string;
};

function mapSendLog(row: SendLogDbRow): SendLogRow {
  return {
    id: row.id,
    dedupeKey: row.dedupe_key,
    automationId: row.automation_id,
    clientId: row.client_id,
    channel: row.channel === "sms" ? "sms" : "email",
    templateId: row.template_id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    detail: row.detail,
    createdAt: row.created_at,
  };
}

export function d1Database(db: D1Database): Db {
  return {
    prepare(sql: string): Stmt {
      return wrapD1(db.prepare(sql));
    },
  };
}

function wrapD1(stmt: D1PreparedStatement): Stmt {
  return {
    bind(...values: unknown[]) {
      return wrapD1(stmt.bind(...values));
    },
    async first<T>() {
      const row = await stmt.first<T>();
      return row ?? null;
    },
    async all<T>() {
      const result = await stmt.all<T>();
      return result.results ?? [];
    },
    async run() {
      const result = await stmt.run();
      return { changes: result.meta.changes ?? 0 };
    },
  };
}
