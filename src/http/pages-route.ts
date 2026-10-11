import { isAdminEmail, readSession } from "../auth";
import type { RuntimeConfig } from "../env";
import { addDays, sydneyDate } from "../time";
import { normalizePhone } from "@balancemoves/contacts-core";
import { loadRuntime, searchMindbodyClients, takeSnapshot, type AppDeps, type Loaded } from "../pipeline/runtime";
import { noteListmonkCheck, readPublicSettings, writeSettings } from "../settings/service";
import { checkTestRecipient } from "../settings/test-recipients";
import { withReplyStop } from "../sms";
import { log } from "../log";
import { html } from "./google";
import { signInPage } from "./html";
import { adminPage } from "./layout";
import { applyEditor, blankAutomation, editorInput } from "./editor";
import {
  evaluateTest,
  sampleFromForm,
  subjectFromSample,
  subjectFromSnapshot,
  type TestSubject,
} from "../automations/test-panel";
import { editPage, editScript, emptyTestPanel, listPage, logCsv, logPage, presentLog, settingsPage, type LogView, type TestClientOption, type TestPanelState } from "./pages";
import type { Automation } from "../automations/types";

const AUTOMATION = /^\/automations\/(\d+)$/;
const TOGGLE = /^\/automations\/(\d+)\/toggle$/;
const TEST = /^\/automations\/(\d+)\/test$/;
const PREVIEW = /^\/automations\/(\d+)\/preview$/;

export async function handleAdminPages(request: Request, env: Env, deps: AppDeps, config: RuntimeConfig, url: URL): Promise<Response | null> {
  if (!isPage(url.pathname, request.method)) return null;
  const session = await readSession(config.sessionSecret, request.headers.get("Cookie"));
  if (!session || !isAdminEmail(session.email, config.adminEmails)) {
    if (url.pathname === "/" && request.method === "GET") {
      return html(signInPage({ configured: Boolean(config.googleClientId && config.googleClientSecret && config.sessionSecret) }));
    }
    return html(signInPage({
      configured: Boolean(config.googleClientId && config.googleClientSecret && config.sessionSecret),
      error: session ? "This Google account is not on the admin list." : undefined,
    }));
  }
  if (url.pathname === "/" && request.method === "GET") return redirect("/automations");
  try {
    const loaded = await loadRuntime(env, deps);
    const settings = await readPublicSettings(loaded.repo, loaded.config, loaded.now);
    if (url.pathname === "/automations" && request.method === "GET") {
      const automations = await loaded.repo.listAutomations();
      const funnels = await loaded.repo.listFunnels();
      return html(adminPage({
        title: "Automations",
        email: session.email,
        active: "automations",
        body: listPage(automations, funnels),
      }));
    }
    if (url.pathname === "/automations/new" && request.method === "GET") {
      return html(adminPage({
        title: "New automation",
        email: session.email,
        active: "automations",
        body: editPage(null, settings, url.searchParams.get("error"), url.searchParams.get("notice")),
        script: editScript(settings.appendReplyStop),
      }));
    }
    if (url.pathname === "/automations" && request.method === "POST") {
      const form = await request.formData();
      const input = editorInput(form);
      const rows = await loaded.repo.listAutomations();
      const id = await loaded.repo.nextAutomationId();
      const key = uniqueKey(input.name, new Set(rows.map((row) => row.key)));
      const draft = applyEditor(blankAutomation(id, key, input.name || "Automation"), input, form.get("enabled") === "on");
      if (typeof draft === "string") return redirect(`/automations/new?error=${draft}`);
      draft.key = key;
      draft.enabled = form.get("enabled") === "on";
      await loaded.repo.createAutomation(draft);
      return redirect(`/automations/${id}?notice=saved`);
    }
    const toggle = url.pathname.match(TOGGLE);
    if (toggle && request.method === "POST") {
      const automation = await loaded.repo.toggleAutomation(Number(toggle[1]));
      if (!automation) return redirect("/automations?error=not_found");
      const back = request.headers.get("Referer") ?? "";
      return redirect(back.includes("/automations/") ? `/automations/${automation.id}` : "/automations");
    }
    const preview = url.pathname.match(PREVIEW);
    if (preview && request.method === "POST") {
      return runAutomationTest(request, deps, loaded, settings, session.email, Number(preview[1]), "preview");
    }
    const test = url.pathname.match(TEST);
    if (test && request.method === "POST") {
      return runAutomationTest(request, deps, loaded, settings, session.email, Number(test[1]), "send");
    }
    const one = url.pathname.match(AUTOMATION);
    if (one && request.method === "GET") {
      const automation = await loaded.repo.getAutomation(Number(one[1]));
      if (!automation) return redirect("/automations?error=not_found");
      const panel = await panelFromQuery(loaded, deps, url.searchParams.get("clientQ") ?? "");
      return html(adminPage({
        title: automation.name,
        email: session.email,
        active: "automations",
        body: editPage(automation, settings, url.searchParams.get("error"), url.searchParams.get("notice"), panel),
        script: editScript(settings.appendReplyStop),
      }));
    }
    if (one && request.method === "POST") {
      const current = await loaded.repo.getAutomation(Number(one[1]));
      if (!current) return redirect("/automations?error=not_found");
      const draft = applyEditor(current, editorInput(await request.formData()), current.enabled);
      if (typeof draft === "string") return redirect(`/automations/${current.id}?error=${draft}`);
      await loaded.repo.updateAutomation(current.id, draft);
      return redirect(`/automations/${current.id}?notice=saved`);
    }
    if (url.pathname === "/log.csv" && request.method === "GET") {
      const rows = await filteredLog(loaded, url.searchParams);
      return new Response(logCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"send-log.csv\"",
          "Cache-Control": "no-store",
        },
      });
    }
    if (url.pathname === "/log" && request.method === "GET") {
      const all = await loaded.repo.listSendLog(200, null);
      const body = all.length === 0
        ? logPage(null, await loaded.repo.listAutomations(), url.searchParams)
        : logPage(await filteredLog(loaded, url.searchParams), await loaded.repo.listAutomations(), url.searchParams);
      return html(adminPage({ title: "Send log", email: session.email, active: "log", body }));
    }
    if (url.pathname === "/settings" && request.method === "GET") {
      return html(adminPage({
        title: "Settings",
        email: session.email,
        active: "settings",
        body: settingsPage(settings, url.searchParams.get("error"), url.searchParams.get("notice")),
      }));
    }
    if (url.pathname === "/settings/listmonk" && request.method === "POST") {
      await saveListmonk(request, loaded);
      return redirect("/settings?notice=saved");
    }
    if (url.pathname === "/settings/test/listmonk" && request.method === "POST") {
      await saveListmonk(request, loaded);
      const fresh = await loadRuntime(env, deps);
      const result = await fresh.listmonk.checkAuth();
      if (!result.ok) return redirect("/settings?error=listmonk_not_connected");
      await noteListmonkCheck(fresh.repo, fresh.now.toISOString(), await fresh.listmonk.templateTotal());
      return redirect("/settings?notice=listmonk_ok");
    }
    if (url.pathname === "/settings/twilio" && request.method === "POST") {
      await saveTwilio(await request.formData(), loaded);
      return redirect("/settings?notice=saved");
    }
    if (url.pathname === "/settings/test/twilio" && request.method === "POST") {
      const form = await request.formData();
      await saveTwilio(form, loaded);
      const fresh = await loadRuntime(env, deps);
      const to = normalizePhone(String(form.get("testPhone") ?? ""));
      if (!to) return redirect("/settings?error=invalid_phone");
      if (!fresh.config.phoneAllowlist.includes(to)) return redirect("/settings?error=not_allowlisted");
      if (fresh.withinQuietHours) return redirect("/settings?error=quiet_hours");
      if (!fresh.connections.twilioAccountSid || !fresh.connections.twilioAuthToken || !fresh.twilio.fromAddress()) {
        return redirect("/settings?error=twilio_not_connected");
      }
      await fresh.twilio.sendSms({
        to,
        body: withReplyStop("Balance Moves automations test. No client was contacted.", fresh.connections.appendReplyStop),
      });
      return redirect("/settings?notice=twilio_ok");
    }
    if (url.pathname === "/settings/from" && request.method === "POST") {
      const form = await request.formData();
      await writeSettings(loaded.repo, loaded.config, {
        defaultFromName: String(form.get("fromName") ?? ""),
        defaultFromEmail: String(form.get("fromEmail") ?? ""),
        defaultReplyTo: String(form.get("replyTo") ?? ""),
      });
      return redirect("/settings?notice=saved");
    }
    if (url.pathname === "/settings/quiet" && request.method === "POST") {
      const form = await request.formData();
      const action = form.get("quietAction") === "skip" ? "skip" : "hold";
      await writeSettings(loaded.repo, loaded.config, {
        quietAction: action,
        smsQuietHours: { start: String(form.get("start") ?? ""), end: String(form.get("end") ?? "") },
      });
      return redirect("/settings?notice=saved");
    }
    if (url.pathname === "/settings/test-recipients" && request.method === "POST") {
      const form = await request.formData();
      await writeSettings(loaded.repo, loaded.config, { testRecipients: String(form.get("testRecipients") ?? "") });
      return redirect("/settings?notice=saved");
    }
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    log({ event: "admin_page_failed", message });
    if (message === "invalid_quiet_hours") return redirect("/settings?error=invalid_quiet_hours");
    return html(adminPage({
      title: "Automations",
      email: session.email,
      active: "automations",
      body: `<div class="err">Something went wrong loading this page.</div>`,
    }));
  }
}

function isPage(pathname: string, method: string): boolean {
  if (pathname === "/" && method === "GET") return true;
  if (pathname === "/automations" && (method === "GET" || method === "POST")) return true;
  if (pathname === "/automations/new" && method === "GET") return true;
  if ((pathname === "/log" || pathname === "/log.csv") && method === "GET") return true;
  if (pathname === "/settings" && method === "GET") return true;
  if (pathname.startsWith("/settings/") && method === "POST") return true;
  if (pathname.startsWith("/automations/") && (method === "GET" || method === "POST")) return true;
  return false;
}

async function saveListmonk(request: Request, loaded: Awaited<ReturnType<typeof loadRuntime>>): Promise<void> {
  const form = await request.formData();
  const token = String(form.get("apiToken") ?? "").trim();
  await writeSettings(loaded.repo, loaded.config, {
    listmonk: {
      baseUrl: String(form.get("baseUrl") ?? ""),
      apiUser: String(form.get("apiUser") ?? ""),
      ...(token ? { apiToken: token } : {}),
    },
  });
}

async function saveTwilio(form: FormData, loaded: Awaited<ReturnType<typeof loadRuntime>>): Promise<void> {
  const accountSid = String(form.get("accountSid") ?? "").trim();
  const authToken = String(form.get("authToken") ?? "").trim();
  await writeSettings(loaded.repo, loaded.config, {
    appendReplyStop: form.get("appendReplyStop") === "on",
    twilio: {
      ...(accountSid ? { accountSid } : {}),
      ...(authToken ? { authToken } : {}),
      fromNumber: String(form.get("fromNumber") ?? ""),
      senderName: String(form.get("senderName") ?? ""),
      fromMode: form.get("fromMode") === "name" ? "name" : "number",
    },
  });
}

async function runAutomationTest(
  request: Request,
  deps: AppDeps,
  loaded: Loaded,
  settings: Awaited<ReturnType<typeof readPublicSettings>>,
  sessionEmail: string,
  id: number,
  mode: "preview" | "send",
): Promise<Response> {
  const automation = await loaded.repo.getAutomation(id);
  if (!automation) return redirect("/automations?error=not_found");
  const form = await request.formData();
  const today = sydneyDate(loaded.now);
  const rawRecipient = String(form.get("recipient") ?? "");
  const recipient = checkTestRecipient(rawRecipient, automation.channel, settings.testRecipients);
  if (mode === "send" && !recipient.ok) return redirect(`/automations/${id}?error=${recipient.error}`);
  const found = await findClients(loaded, deps, String(form.get("clientQ") ?? ""));
  const panel = panelFromForm(form, found);
  const subjectResult = await loadSubject(form, loaded, deps, today);
  if ("error" in subjectResult) {
    if (mode === "send") return redirect(`/automations/${id}?error=${subjectResult.error}`);
    return editResponse(automation, settings, sessionEmail, subjectResult.error, panel);
  }
  const preview = evaluateTest(automation, subjectResult.subject, today, {
    studioName: loaded.config.studioName || "Balance Moves",
    appendReplyStop: loaded.connections.appendReplyStop,
  });
  panel.preview = {
    headline: preview.headline,
    renderedTitle: preview.renderedTitle,
    rendered: preview.rendered,
    recipientNote: recipientNote(recipient, rawRecipient),
  };
  if (mode === "preview") return editResponse(automation, settings, sessionEmail, null, panel);
  if (!recipient.ok) return redirect(`/automations/${id}?error=${recipient.error}`);
  try {
    if (automation.channel === "sms") {
      if (!recipient.phone) return redirect(`/automations/${id}?error=invalid_recipient`);
      if (!loaded.connections.twilioAccountSid || !loaded.connections.twilioAuthToken || !loaded.twilio.fromAddress()) {
        return redirect(`/automations/${id}?error=twilio_not_connected`);
      }
      await loaded.twilio.sendSms({ to: recipient.phone, body: preview.rendered });
    } else {
      if (!automation.templateId) return redirect(`/automations/${id}?error=template_missing`);
      if (!recipient.email) return redirect(`/automations/${id}?error=invalid_recipient`);
      if (!loaded.connections.listmonkApiToken) return redirect(`/automations/${id}?error=listmonk_not_connected`);
      await loaded.listmonk.sendTx({
        email: recipient.email,
        templateId: automation.templateId,
        data: preview.data,
      });
    }
    await loaded.repo.recordSend({
      dedupeKey: `test:${automation.id}:${subjectResult.subject.clientId}:${loaded.now.toISOString()}:${crypto.randomUUID()}`,
      automationId: automation.id,
      clientId: subjectResult.subject.clientId,
      channel: automation.channel,
      templateId: automation.templateId,
      email: recipient.email,
      phone: recipient.phone,
      status: "test",
      detail: `TEST. ${preview.headline} Client not contacted. Bypassed: automation off, dedupe, quiet hours.`,
    });
    return redirect(`/automations/${id}?notice=test_sent`);
  } catch (error) {
    log({ event: "admin_test_failed", message: error instanceof Error ? error.message : "test_failed" });
    return redirect(`/automations/${id}?error=test_failed`);
  }
}


function editResponse(
  automation: Automation,
  settings: Awaited<ReturnType<typeof readPublicSettings>>,
  sessionEmail: string,
  error: string | null,
  panel: TestPanelState,
): Response {
  return html(adminPage({
    title: automation.name,
    email: sessionEmail,
    active: "automations",
    body: editPage(automation, settings, error, null, panel),
    script: editScript(settings.appendReplyStop),
  }));
}

async function panelFromQuery(loaded: Loaded, deps: AppDeps, clientQuery: string): Promise<TestPanelState> {
  const found = await findClients(loaded, deps, clientQuery);
  const panel = emptyTestPanel();
  panel.clientQuery = clientQuery;
  panel.clients = found.clients;
  panel.searchError = found.searchError;
  panel.source = found.clients.length > 0 ? "client" : "sample";
  return panel;
}

async function findClients(
  loaded: Loaded,
  deps: AppDeps,
  clientQuery: string,
): Promise<{ clients: TestClientOption[]; searchError: string | null }> {
  const query = clientQuery.trim();
  if (query.length === 0) return { clients: [], searchError: null };
  if (query.length < 2) return { clients: [], searchError: "Type at least 2 characters." };
  try {
    const hits = await searchMindbodyClients(loaded, deps, query);
    return {
      clients: hits.map((hit) => ({
        id: hit.id,
        name: [hit.firstName, hit.lastName].filter(Boolean).join(" ") || `Client ${hit.id}`,
        email: hit.email,
        phone: hit.phone,
      })),
      searchError: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    log({ event: "mindbody_search_failed", message });
    const searchError = message === "mindbody_staff_credentials_missing"
      ? "Mindbody is not connected. Enter sample values instead."
      : "Mindbody search did not respond. Enter sample values instead.";
    return { clients: [], searchError };
  }
}

function panelFromForm(
  form: FormData,
  found: { clients: TestClientOption[]; searchError: string | null },
): TestPanelState {
  const panel = emptyTestPanel();
  panel.clientQuery = String(form.get("clientQ") ?? "");
  panel.clients = found.clients;
  panel.searchError = found.searchError;
  panel.source = form.get("source") === "client" ? "client" : "sample";
  panel.clientId = String(form.get("clientId") ?? "");
  panel.recipient = String(form.get("recipient") ?? "");
  panel.sample = sampleFromForm(form);
  return panel;
}

async function loadSubject(
  form: FormData,
  loaded: Loaded,
  deps: AppDeps,
  today: string,
): Promise<{ subject: TestSubject } | { error: string }> {
  if (form.get("source") === "client") {
    const clientId = String(form.get("clientId") ?? "").trim();
    if (!clientId) return { error: "client_required" };
    try {
      const snapshot = await takeSnapshot(loaded, deps, clientId);
      return { subject: subjectFromSnapshot(clientId, snapshot) };
    } catch (error) {
      log({ event: "mindbody_snapshot_failed", message: error instanceof Error ? error.message : "mindbody_search_failed" });
      return { error: "mindbody_search_failed" };
    }
  }
  return { subject: subjectFromSample(sampleFromForm(form), today) };
}

function recipientNote(
  recipient: ReturnType<typeof checkTestRecipient>,
  raw: string,
): string | null {
  if (!raw.trim()) return "Add a recipient before Send test. Preview does not send.";
  if (!recipient.ok) return "Send test would be refused until this address is on the Test recipients list in Settings.";
  return "This recipient is on the Test recipients list.";
}

async function filteredLog(loaded: Awaited<ReturnType<typeof loadRuntime>>, query: URLSearchParams): Promise<LogView[]> {
  const automations = await loaded.repo.listAutomations();
  const names = new Map(automations.map((row) => [row.id, row.name]));
  const rows = await loaded.repo.listSendLog(200, null);
  const today = sydneyDate(loaded.now);
  const range = query.get("range") === "1" ? 0 : query.get("range") === "30" ? 30 : 7;
  const earliest = range === 0 ? today : addDays(today, -range);
  const automation = query.get("automation");
  const channel = query.get("channel");
  const status = query.get("status");
  const q = (query.get("q") ?? "").trim().toLowerCase();
  return rows
    .map((row) => presentLog(row, names))
    .filter((row, index) => {
      const source = rows[index];
      if (!source) return false;
      const day = sydneyDate(new Date(source.createdAt));
      if (day < earliest || day > today) return false;
      if (automation && automation !== "all" && String(source.automationId) !== automation) return false;
      if (channel === "email" && source.channel !== "email") return false;
      if (channel === "sms" && source.channel !== "sms") return false;
      if (status && status !== "all" && row.status !== status) return false;
      if (q && !`${row.client} ${row.contact} ${row.automation}`.toLowerCase().includes(q)) return false;
      return true;
    });
}

function uniqueKey(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "automation";
  let key = base;
  let n = 2;
  while (taken.has(key) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)) {
    key = `${base}-${n}`;
    n += 1;
  }
  return key;
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
