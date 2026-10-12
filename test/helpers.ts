import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { D1Database } from "@cloudflare/workers-types";
import { d1Database, Repo, type Db } from "../src/db/repo";
import type { ClientSnapshot } from "@balancemoves/contacts-core";
import type { Visit } from "../src/automations/types";

export function applyMigrations(db: DatabaseSync): void {
  const files = readdirSync("migrations").filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) db.exec(readFileSync(`migrations/${file}`, "utf8"));
}

export function openSqlite(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applyMigrations(db);
  return db;
}

export function asD1(sqlite: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      const wrap = (values: unknown[]) => ({
        bind(...more: unknown[]) {
          return wrap(more);
        },
        async first<T>() {
          const row = statement.get(...values) as T | undefined;
          return row ?? null;
        },
        async all<T>() {
          return { results: statement.all(...values) as T[] };
        },
        async run() {
          const result = statement.run(...values);
          return { success: true, meta: { changes: Number(result.changes) } };
        },
      });
      return wrap([]);
    },
    async batch(statements: { run(): Promise<unknown> }[]) {
      for (const statement of statements) await statement.run();
      return statements.map(() => ({ success: true, meta: { changes: 0 } }));
    },
  } as unknown as D1Database;
}

/** Wrap a Db so tests can count seed INSERT batches from ensureSeed. */
export function trackingDb(db: Db, log: { seedWrites: number }): Db {
  return {
    prepare(sql: string) {
      return db.prepare(sql);
    },
    async batch(statements) {
      log.seedWrites += statements.length;
      return db.batch(statements);
    },
  };
}

export function testEnv(db: D1Database, extra: Record<string, string> = {}): Env {
  return {
    DB: db,
    DEV_MODE: "true",
    DRY_RUN: "false",
    SEND_ALLOWLIST: "bondi@balancemoves.com.au",
    SMS_ALLOWLIST: "",
    MINDBODY_SITE_ID: "9853",
    LISTMONK_BASE_URL: "https://campaigns.balancemoves.com.au",
    LISTMONK_LIST_ID: "3",
    LISTMONK_SUPPRESSED_LIST_ID: "",
    SYDNEY_SEND_HOUR: "9",
    ADMIN_EMAILS: "owner@balancemoves.com.au",
    DEFAULT_FROM_EMAIL: "",
    SMS_QUIET_START: "20:00",
    SMS_QUIET_END: "09:00",
    STUDIO_NAME: "Balance Moves",
    TWILIO_FROM_NUMBER: "",
    TWILIO_SENDER_NAME: "",
    MINDBODY_API_KEY: "",
    MINDBODY_STAFF_USERNAME: "",
    MINDBODY_STAFF_PASSWORD: "",
    MINDBODY_WEBHOOK_SIGNATURE_KEY: "sign-key",
    LISTMONK_API_USER: "",
    LISTMONK_API_TOKEN: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    SESSION_SECRET: "session-secret",
    SETTINGS_ENCRYPTION_KEY: "settings-key",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    ...extra,
  } as unknown as Env;
}

export function testRepo(sqlite = openSqlite()): Repo {
  return new Repo(d1Database(asD1(sqlite)), () => "2026-10-11T00:00:00.000Z");
}

export function visit(partial: Partial<Visit> & Pick<Visit, "serviceName">): Visit {
  return {
    id: partial.id ?? 1,
    signedIn: partial.signedIn ?? true,
    lateCancelled: partial.lateCancelled ?? false,
    earlyCancelled: partial.earlyCancelled ?? false,
    serviceName: partial.serviceName,
    startSydney: partial.startSydney ?? null,
  };
}

export function emptySnapshot(partial: Partial<ClientSnapshot> = {}): ClientSnapshot {
  return {
    profile: {
      email: "ada@example.com",
      phone: "+61411111111",
      firstName: "Ada",
      lastName: "Lovelace",
      createdAt: "2026-08-01T00:00:00Z",
      waiverSigned: false,
      ...partial.profile,
    },
    services: partial.services ?? [],
    contracts: partial.contracts ?? [],
    visits: partial.visits ?? [],
  };
}

export type SqliteDb = Db;
