import { clearSessionCookie, isAdminEmail, readSession } from "../auth";
import { log } from "../log";
import { normalizePhone } from "@balancemoves/contacts-core";
import { loadRuntime, type AppDeps } from "../pipeline/runtime";
import { handleLeadWebhook, handleWebhook, previewBody, publicPlan } from "../pipeline/webhook";
import { runScheduled } from "../pipeline/cron";
import type { RuntimeConfig } from "../env";
import { bindingsFromEnv, runtimeConfig } from "../env";
import { noteListmonkCheck, readPublicSettings, writeSettings, type SettingsPatch } from "../settings/service";
import { MERGE_FIELDS } from "../merge/fields";
import { exampleMerge } from "../merge/values";
import { withReplyStop } from "../sms";
import { automationFromBody, mergeAutomation } from "./automation-body";
import { finishGoogleLogin, startGoogleLogin } from "./google";
import { handleAdminPages } from "./pages-route";

const AUTOMATION = /^\/admin\/automations\/(\d+)$/;
const TOGGLE = /^\/admin\/automations\/(\d+)\/toggle$/;

export type App = Required<Pick<ExportedHandler<Env>, "fetch" | "scheduled">>;

export function createApp(deps: AppDeps): App {
  return {
    async fetch(request, env) {
      return route(request, env, deps);
    },
    async scheduled(_controller, env) {
      await runScheduled(env, deps);
    },
  };
}

async function route(request: Request, env: Env, deps: AppDeps): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    const config = runtimeConfig(bindingsFromEnv(env));
    return Response.json({ ok: true, service: "bm-automations", devMode: config.devMode });
  }
  if (url.pathname === "/webhooks/mindbody" && (request.method === "HEAD" || request.method === "GET")) {
    // Mindbody checks the webhook URL with HEAD when a subscription is created; it must answer 200.
    return new Response(null, { status: 200 });
  }
  if (url.pathname === "/webhooks/mindbody" && request.method === "POST") {
    const result = await handleWebhook(request, env, deps);
    return Response.json(result.body, { status: result.status });
  }
  if (url.pathname === "/webhooks/lead" && request.method === "POST") {
    const result = await handleLeadWebhook(request, env, deps);
    return Response.json(result.body, { status: result.status });
  }
  const config = runtimeConfig(bindingsFromEnv(env));
  if (url.pathname === "/login" && request.method === "GET") return startGoogleLogin(config, url.origin);
  if (url.pathname === "/auth/google/callback" && request.method === "GET") {
    return finishGoogleLogin(request, config, url, deps.fetchImpl);
  }
  if (url.pathname === "/logout" && request.method === "POST") {
    return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": clearSessionCookie() } });
  }
  if (!url.pathname.startsWith("/admin")) {
    const page = await handleAdminPages(request, env, deps, config, url);
    if (page) return page;
  }
  if (url.pathname.startsWith("/admin")) return admin(request, env, deps, config, url);
  return new Response("not found", { status: 404 });
}

async function admin(request: Request, env: Env, deps: AppDeps, config: RuntimeConfig, url: URL): Promise<Response> {
  const session = await readSession(config.sessionSecret, request.headers.get("Cookie"));
  if (!session || !isAdminEmail(session.email, config.adminEmails)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const loaded = await loadRuntime(env, deps);
    const toggle = url.pathname.match(TOGGLE);
    if (toggle && request.method === "POST") {
      const automation = await loaded.repo.toggleAutomation(Number(toggle[1]));
      if (!automation) return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json({ automation });
    }
    const one = url.pathname.match(AUTOMATION);
    if (one && request.method === "GET") {
      const automation = await loaded.repo.getAutomation(Number(one[1]));
      if (!automation) return Response.json({ error: "not_found" }, { status: 404 });
      return Response.json({ automation });
    }
    if (one && request.method === "PATCH") {
      const current = await loaded.repo.getAutomation(Number(one[1]));
      if (!current) return Response.json({ error: "not_found" }, { status: 404 });
      const merged = mergeAutomation(current, await readJson(request));
      if (typeof merged === "string") return Response.json({ error: merged }, { status: 400 });
      const automation = await loaded.repo.updateAutomation(current.id, merged);
      return Response.json({ automation });
    }
    if (url.pathname === "/admin/automations" && request.method === "GET") {
      return Response.json({ automations: await loaded.repo.listAutomations() });
    }
    if (url.pathname === "/admin/automations" && request.method === "POST") {
      const id = await loaded.repo.nextAutomationId();
      const parsed = automationFromBody(await readJson(request), id);
      if (typeof parsed === "string") return Response.json({ error: parsed }, { status: 400 });
      try {
        const automation = await loaded.repo.createAutomation(parsed);
        return Response.json({ automation }, { status: 201 });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (/unique|constraint/i.test(message)) return Response.json({ error: "conflict" }, { status: 409 });
        throw error;
      }
    }
    if (url.pathname === "/admin/send-log" && request.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? "50");
      const automationId = url.searchParams.get("automationId");
      const rows = await loaded.repo.listSendLog(Number.isFinite(limit) ? limit : 50, automationId ? Number(automationId) : null);
      return Response.json({ sendLog: rows });
    }
    if (url.pathname === "/admin/settings" && request.method === "GET") {
      return Response.json(await readPublicSettings(loaded.repo, loaded.config, loaded.now));
    }
    if (url.pathname === "/admin/settings" && request.method === "PATCH") {
      const body = (await readJson(request)) as SettingsPatch;
      const settings = await writeSettings(loaded.repo, loaded.config, body);
      return Response.json(settings);
    }
    if (url.pathname === "/admin/settings/test/listmonk" && request.method === "POST") {
      const result = await loaded.listmonk.checkAuth();
      if (result.ok) await noteListmonkCheck(loaded.repo, loaded.now.toISOString(), await loaded.listmonk.templateTotal());
      return Response.json({ ok: result.ok, status: result.status });
    }
    if (url.pathname === "/admin/settings/test/twilio" && request.method === "POST") {
      const body = (await readJson(request)) as { to?: string };
      const to = normalizePhone(body.to);
      if (!to) return Response.json({ error: "invalid_phone" }, { status: 400 });
      if (!loaded.config.phoneAllowlist.includes(to)) return Response.json({ error: "not_allowlisted" }, { status: 403 });
      if (loaded.withinQuietHours) return Response.json({ error: "quiet_hours" }, { status: 409 });
      if (!loaded.connections.twilioAccountSid || !loaded.connections.twilioAuthToken || !loaded.twilio.fromAddress()) {
        return Response.json({ error: "twilio_not_connected" }, { status: 400 });
      }
      await loaded.twilio.sendSms({
        to,
        body: withReplyStop("Balance Moves automations test. No client was contacted.", loaded.connections.appendReplyStop),
      });
      return Response.json({ ok: true });
    }
    if (url.pathname === "/admin/merge-fields" && request.method === "GET") {
      const preview = exampleMerge();
      return Response.json({
        fields: MERGE_FIELDS.map((field) => ({
          loyalSnap: field.loyalSnap,
          key: field.key || null,
          type: field.type,
          optOut: field.optOut,
          mindbody: field.gap ? "gap" : field.mindbody,
          attrib: field.attrib ? `attribs.${field.attrib}` : null,
          syntax: field.syntax,
          example: field.example,
          fallback: field.fallback,
          gap: field.gap,
          insert: field.insert,
        })),
        preview: preview.data,
      });
    }
    if (url.pathname === "/admin/dry-run" && request.method === "POST") {
      const result = await previewBody(await request.text(), env, deps);
      if (result.status === 200 && Array.isArray(result.body.plans)) {
        return Response.json(result.body, { status: 200 });
      }
      return Response.json(result.body, { status: result.status });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    if (error instanceof SyntaxError) return Response.json({ error: "invalid_json" }, { status: 400 });
    if (message === "invalid_quiet_hours") return Response.json({ error: message }, { status: 400 });
    if (message === "settings_encryption_key_missing") return Response.json({ error: message }, { status: 500 });
    log({ event: "admin_failed", message });
    return Response.json({ error: "admin_failed" }, { status: 500 });
  }
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return {};
  return JSON.parse(text);
}

export { publicPlan };
