import { LOYALSNAP_LIVE_KEYS } from "../automations/seed";
import { derivedAudience, derivedDelay, derivedTrigger, RULE_FIELDS, type AudienceChoice, type DelayChoice, type RuleTrigger, type TriggerChoice } from "./editor";
import { listDelay, listTrigger, smsListPreview } from "../automations/labels";
import { TEMPLATE_SUBJECTS, templateLabel } from "../automations/subjects";
import type { Automation, SendLogRow } from "../automations/types";
import { escapeHtml } from "./layout";
import type { PublicSettings } from "../settings/service";
import { MERGE_FIELDS } from "../merge/fields";
import { exampleMerge, substitutionRules } from "../merge/values";
import { REPLY_STOP_FOOTER } from "../sms";
import { formatSydney } from "../time";

export function listPage(automations: Automation[], stats: Map<number, { lastSent: string | null; sends7d: number }>, query: URLSearchParams): string {
  const channel = query.get("channel") === "email" || query.get("channel") === "sms" ? query.get("channel") : "all";
  const status = query.get("status") === "on" || query.get("status") === "off" ? query.get("status") : "all";
  const emails = automations.filter((row) => row.channel === "email").length;
  const texts = automations.length - emails;
  const rows = automations.filter((row) => {
    if (channel === "email" && row.channel !== "email") return false;
    if (channel === "sms" && row.channel !== "sms") return false;
    if (status === "on" && !row.enabled) return false;
    if (status === "off" && row.enabled) return false;
    return true;
  });
  const off = automations.filter((row) => !row.enabled).length;
  const banner = off === automations.length
    ? `All ${automations.length} automations are <b>off</b>. Nothing sends until you switch one on. Turn the matching LoyalSnap automation off the same day.`
    : `<b>${automations.length - off}</b> of ${automations.length} automations are on. Turn the matching LoyalSnap automation off the same day you switch one on.`;
  const option = (value: string, label: string, current: string) =>
    `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  const live = rows.filter((row) => LOYALSNAP_LIVE_KEYS.has(row.key));
  const unused = rows.filter((row) => !LOYALSNAP_LIVE_KEYS.has(row.key));
  const empty = `<tr><td colspan="8" class="muted">No automations match these filters.</td></tr>`;
  const liveBody = live.map((row) => listRow(row, stats.get(row.id))).join("");
  const unusedBody = unused.map((row) => listRow(row, stats.get(row.id))).join("");
  const unusedBlock = unused.length === 0
    ? ""
    : `<details class="unused"><summary>Not in use <span class="muted">${unused.length}</span></summary><div class="table-wrap"><table class="cards"><thead><tr><th>On/off</th><th>Name</th><th>Channel</th><th>Trigger</th><th>Delay</th><th>Template / text</th><th>Last sent</th><th>Sends 7d</th></tr></thead><tbody>${unusedBody}</tbody></table></div></details>`;
  return `<header><div><h1>Automations</h1><p class="muted" style="margin:0">Emails via listmonk · texts via Twilio · times in Sydney</p></div></header>
<div class="banner">${banner}</div>
<form class="bar" method="get" action="/automations"><div class="filters">
<label>Channel<select name="channel" onchange="this.form.submit()">${option("all", `All (${automations.length})`, channel ?? "all")}${option("email", `Email (${emails})`, channel ?? "all")}${option("sms", `Text (${texts})`, channel ?? "all")}</select></label>
<label>Status<select name="status" onchange="this.form.submit()">${option("all", "All", status ?? "all")}${option("on", "On", status ?? "all")}${option("off", "Off", status ?? "all")}</select></label>
</div><a class="btn" href="/automations/new">+ New automation</a></form>
<div class="table-wrap"><table class="cards"><thead><tr><th>On/off</th><th>Name</th><th>Channel</th><th>Trigger</th><th>Delay</th><th>Template / text</th><th>Last sent</th><th>Sends 7d</th></tr></thead><tbody>${liveBody || empty}</tbody></table></div>
${unusedBlock}`;
}

function listRow(row: Automation, stat: { lastSent: string | null; sends7d: number } | undefined): string {
  const on = row.enabled;
  const channel = row.channel === "sms"
    ? `<span class="pill text">💬 Text</span>`
    : `<span class="pill email">✉ Email</span>`;
  const preview = row.channel === "sms"
    ? smsListPreview(row.messageText ?? "")
    : templateLabel(row.templateId);
  const last = stat?.lastSent ? formatSydney(new Date(stat.lastSent)) : "Never";
  return `<tr><td data-l="On/off"><form method="post" action="/automations/${row.id}/toggle" style="display:inline"><button class="plain" type="submit" aria-label="${on ? "Switch off" : "Switch on"}"><span class="sw${on ? " on" : ""}"></span></button></form> <span class="small muted">${on ? "On" : "Off"}</span></td>
<td data-l="Name"><a class="name" href="/automations/${row.id}">${escapeHtml(row.name)}</a></td>
<td data-l="Channel">${channel}</td>
<td data-l="Trigger">${escapeHtml(listTrigger(row))}</td>
<td data-l="Delay">${escapeHtml(listDelay(row))}</td>
<td data-l="Template / text" class="prev">${escapeHtml(preview)}</td>
<td data-l="Last sent" class="muted">${escapeHtml(last)}</td>
<td data-l="Sends 7d">${stat?.sends7d ?? 0}</td></tr>`;
}

export function editPage(automation: Automation | null, settings: PublicSettings, error: string | null, notice: string | null = null): string {
  const creating = automation === null;
  const name = automation?.name ?? "";
  const channel = automation?.channel ?? "email";
  const trigger = automation ? derivedTrigger(automation) : "client";
  const audience = automation ? derivedAudience(automation) : "all";
  const delay = automation ? derivedDelay(automation) : "immediate";
  const days = automation?.timingOffsetDays ?? (delay === "immediate" ? "" : 0);
  const templateId = automation?.channel === "email" ? automation.templateId ?? null : 5;
  const message = automation?.messageText ?? "";
  const subject = templateId ? TEMPLATE_SUBJECTS[templateId] ?? "" : "";
  const fromLine = `${settings.defaultFromName} &lt;${escapeHtml(settings.defaultFromEmail)}&gt;`;
  const stop = settings.appendReplyStop ? "on" : "off";
  const blank = `<option value=""${channel === "email" && templateId === null ? " selected" : ""}>No listmonk template yet</option>`;
  const templates = blank + Object.entries(TEMPLATE_SUBJECTS)
    .map(([id, text]) => `<option value="${id}"${Number(id) === templateId && channel === "email" ? " selected" : ""}>${escapeHtml(`${id} · ${text}`)}</option>`)
    .join("");
  const check = (nameAttr: string, label: string, checked: boolean) =>
    `<label class="radio"><input type="checkbox" name="${nameAttr}"${checked ? " checked" : ""}> ${label}</label>`;
  const action = creating ? "/automations" : `/automations/${automation.id}`;
  const title = creating ? "New automation" : automation.name;
  const enabled = automation?.enabled ?? false;
  const toggle = creating
    ? `<label class="radio"><input type="checkbox" name="enabled"> Off until you switch it on</label>`
    : `<form method="post" action="/automations/${automation.id}/toggle"><button class="plain" type="submit"><span class="sw${enabled ? " on" : ""}"></span> ${enabled ? "On" : "Off"}</button></form>`;
  return `${flash(error)}${notice ? `<div class="banner">${escapeHtml(noticeText(notice))}</div>` : ""}<header><div><h1>${creating ? "New automation" : "Edit automation"}</h1><p class="muted" style="margin:0">Emails via listmonk · texts via Twilio · times in Sydney</p></div></header>
<p class="small"><a href="/automations" style="color:var(--accent)">← Automations</a></p>
<div class="bar"><div><h2 style="font-size:1.25rem">${escapeHtml(title || "New automation")}</h2><span class="muted small">${creating ? "New automation" : "Edit automation"}</span></div>${toggle}</div>
<form method="post" action="${action}"><div class="grid"><div class="card full" style="margin:0"><div class="grid">
<label>Name<input name="name" value="${escapeHtml(name)}" required></label>
<label>Channel<div class="seg" id="seg">
<label><input type="radio" name="channel" value="email"${channel === "email" ? " checked" : ""}> ✉ Email</label>
<label><input type="radio" name="channel" value="sms"${channel === "sms" ? " checked" : ""}> 💬 Text</label>
</div></label></div></div>
<div class="card" style="margin:0"><h2>Message</h2>
<div id="emailbox"${channel === "email" ? "" : " hidden"}><label>listmonk template<select name="templateId" id="template">${templates}</select></label>
<p class="small muted">Edit the design in listmonk. Subject and from address come from the template and Settings. Templates read {{ .Tx.Data.FirstName }} and {{ .Subscriber.Attribs.pack_name }}. The full list is GET /admin/merge-fields.</p>
<div class="preview"><div class="hd">Subject: <span id="subject">${escapeHtml(subject)}</span><br>From: ${fromLine}</div>
<div class="mail"><div class="logo">BALANCE MOVES</div><b>Hi Alex,</b><p>Welcome to your Intro Pass! Here's how to book your first class…</p><p class="muted small">Example client data</p></div></div></div>
<div id="textbox"${channel === "sms" ? "" : " hidden"}><label>Text message<textarea name="messageText" id="sms">${escapeHtml(message)}</textarea></label>
<label class="small">Insert field<select id="insert-field"><option value="">Choose a field…</option>${MERGE_FIELDS.filter((field) => field.insert).map((field) => `<option value="${escapeHtml(field.insert)}">${escapeHtml(field.insert)}</option>`).join("")}</select></label>
<div class="counter"><span id="cc"></span><span>"Reply STOP" footer: ${stop} (<a href="/settings">Settings</a>)</span></div>
<p class="small muted" style="margin-bottom:6px">Phone preview <span class="ex">example</span></p><div class="bubble" id="bub"></div></div></div>
<div class="card" style="margin:0"><h2>When and who</h2>
<label>Trigger<select name="trigger" id="trigger">${triggerOptions(trigger)}</select></label>
${ruleBox(automation, trigger)}
<label>Who it's for<select name="audience">${audienceOptions(audience)}</select></label><br>
<div id="delay-box"${isRule(trigger) ? " hidden" : ""}><label>Delay<div style="display:flex;gap:8px"><input name="delayDays" type="number" min="0" step="1" value="${days}" style="width:80px"><select name="delay">${delayOptions(delay)}</select></div></label></div><br>
<label>Stop rules (skip if any is true)</label>
${check("skipBooking", "Has booked or taken a class", Boolean(automation?.skipRules.skipIfHasBooking))}
${check("skipMembership", "Bought a membership", Boolean(automation?.skipRules.skipIfMembership))}
${check("skipSent", "Already sent this automation once", automation ? automation.skipRules.skipIfAlreadySent !== false : true)}
${check("skipUnsubscribed", "No mobile number / unsubscribed", Boolean(automation?.skipRules.skipIfUnsubscribed))}
</div></div>
<div class="actions">${creating ? "" : `<input name="testPhone" placeholder="Mobile for a test text" style="width:190px"><button class="ghost" type="submit" formaction="/automations/${automation.id}/test">Send test to me</button>`}<a class="btn ghost" href="/automations">Cancel</a><button type="submit">Save</button></div></form>`;
}

export function editScript(appendReplyStop: boolean): string {
  const gsm = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€";
  const extended = "^{}\\[~]|€";
  return `const subjects=${JSON.stringify(TEMPLATE_SUBJECTS)};const footer=${JSON.stringify(REPLY_STOP_FOOTER)};const stop=${appendReplyStop ? "true" : "false"};const G=${JSON.stringify(gsm)};const ext=${JSON.stringify(extended)};
const rules=${JSON.stringify(substitutionRules())};const sample=${JSON.stringify(exampleMerge().data)};
const sms=document.getElementById("sms");const cc=document.getElementById("cc");const bub=document.getElementById("bub");
const emailbox=document.getElementById("emailbox");const textbox=document.getElementById("textbox");
function preview(raw){let v=raw;for(const rule of rules){const repl=sample[rule.key]==null?"":String(sample[rule.key]);v=v.replace(new RegExp(rule.source,rule.flags),repl)}v=v.replace(/[ \\t]{2,}/g," ").replace(/ +([,.;!?])/g,"$1").trim();return stop&&!/reply stop/i.test(v)?v+footer:v}
function upd(){if(!sms||!cc||!bub)return;const v=preview(sms.value);const gsm=[...v].every(c=>G.includes(c));let n=0;for(const c of v)n+=ext.includes(c)?2:1;if(!gsm)n=[...v].length;const one=gsm?160:70,multi=gsm?153:67;const s=n===0?0:(n<=one?1:Math.ceil(n/multi));cc.textContent=n+" characters · "+s+" segment"+(s===1?"":"s")+" · "+(gsm?"GSM-7":"Unicode")+" · ≈ "+s+" × Twilio price";bub.textContent=v}
if(sms){sms.addEventListener("input",upd);upd()}
const picker=document.getElementById("insert-field");
picker?.addEventListener("change",()=>{if(!sms||!picker.value)return;const start=sms.selectionStart??sms.value.length;const end=sms.selectionEnd??start;sms.setRangeText(picker.value,start,end,"end");picker.value="";upd();sms.focus()});
function sync(){const c=document.querySelector('input[name=channel]:checked');if(!c||!emailbox||!textbox)return;emailbox.hidden=c.value!=="email";textbox.hidden=c.value!=="sms"}
document.getElementById("seg")?.addEventListener("change",sync);
if(location.hash==="#email"){const el=document.querySelector('input[name=channel][value=email]');if(el)el.checked=true}
if(location.hash==="#text"){const el=document.querySelector('input[name=channel][value=sms]');if(el)el.checked=true}
sync();
const template=document.getElementById("template");
function syncSubject(){const line=document.getElementById("subject");if(template&&line)line.textContent=subjects[template.value]||""}
template?.addEventListener("change",syncSubject);
syncSubject();
const ruleMeta=${JSON.stringify(RULE_FIELDS)};
const triggerSel=document.getElementById("trigger");
function syncRule(){const box=document.getElementById("rule-box");const delay=document.getElementById("delay-box");const numLabel=document.getElementById("rule-number-label");const numName=document.getElementById("rule-number-name");const num=document.getElementById("rule-number");const dateLabel=document.getElementById("rule-date-label");const dateName=document.getElementById("rule-date-name");const help=document.getElementById("rule-help");if(!triggerSel||!box||!num||!numLabel||!dateLabel||!help||!numName||!dateName)return;const meta=ruleMeta[triggerSel.value];box.hidden=!meta;if(delay)delay.hidden=Boolean(meta);if(!meta){num.disabled=true;return}const date=meta.input==="date";numLabel.hidden=date;num.disabled=date;dateLabel.hidden=!date;numName.textContent=meta.label;dateName.textContent=meta.label;help.textContent=meta.help}
triggerSel?.addEventListener("change",syncRule);
syncRule();`;
}

export function logPage(rows: LogView[] | null, automations: Automation[], query: URLSearchParams): string {
  const range = query.get("range") === "1" || query.get("range") === "30" ? query.get("range") : "7";
  const automation = query.get("automation") ?? "all";
  const channel = query.get("channel") === "email" || query.get("channel") === "sms" ? query.get("channel") : "all";
  const status = ["sent", "skipped", "failed", "bounced"].includes(query.get("status") ?? "") ? query.get("status") : "all";
  const q = query.get("q") ?? "";
  const option = (value: string, label: string, current: string | null) =>
    `<option value="${escapeHtml(value)}"${value === current ? " selected" : ""}>${escapeHtml(label)}</option>`;
  const names = automations.map((row) => option(String(row.id), row.name, automation)).join("");
  const example = rows === null;
  const body = example ? EXAMPLE_ROWS : rows.map(logRow).join("") || `<tr><td colspan="7" class="muted">No sends match these filters.</td></tr>`;
  const csv = `/log.csv?${new URLSearchParams({ range: range ?? "7", automation, channel: channel ?? "all", status: status ?? "all", q }).toString()}`;
  return `<header><div><h1>Send log</h1><p class="muted" style="margin:0">Emails via listmonk · texts via Twilio · times in Sydney</p></div></header>
${example ? `<div class="banner">Example data. All automations are off, so the real log is empty until one is switched on.</div>` : ""}
<form class="bar" method="get" action="/log"><div class="filters">
<label>Date<select name="range" onchange="this.form.submit()">${option("7", "Last 7 days", range)}${option("1", "Today", range)}${option("30", "Last 30 days", range)}</select></label>
<label>Automation<select name="automation" onchange="this.form.submit()">${option("all", "All", automation)}${names}</select></label>
<label>Channel<select name="channel" onchange="this.form.submit()">${option("all", "All", channel)}${option("email", "Email", channel)}${option("sms", "Text", channel)}</select></label>
<label>Status<select name="status" onchange="this.form.submit()">${option("all", "All", status)}${option("sent", "Sent", status)}${option("skipped", "Skipped", status)}${option("failed", "Failed", status)}${option("bounced", "Bounced", status)}</select></label>
<label>Client<input name="q" value="${escapeHtml(q)}" placeholder="Name, email or phone" onchange="this.form.submit()"></label>
</div><a class="btn ghost" href="${csv}">Export CSV</a></form>
<div class="table-wrap"><table class="cards"><thead><tr><th>When (Sydney)</th><th>Client</th><th>Email / phone</th><th>Automation</th><th>Channel</th><th>Status</th><th>Detail</th></tr></thead><tbody>${body}</tbody></table></div>`;
}

export type LogView = {
  when: string;
  client: string;
  contact: string;
  automation: string;
  channel: "email" | "sms";
  status: "sent" | "skipped" | "failed" | "bounced";
  detail: string;
};

export function presentLog(row: SendLogRow, names: Map<number, string>): LogView {
  const status = row.status.includes("bounce") ? "bounced" : row.status.includes("fail") ? "failed" : row.status === "sent" ? "sent" : "skipped";
  return {
    when: formatSydney(new Date(row.createdAt)),
    client: row.clientId,
    contact: row.email || row.phone || "—",
    automation: names.get(row.automationId) ?? `Automation ${row.automationId}`,
    channel: row.channel,
    status,
    detail: row.detail || (status === "sent" ? "—" : row.status.replaceAll("_", " ")),
  };
}

export function logCsv(rows: LogView[]): string {
  const header = ["when", "client", "contact", "automation", "channel", "status", "detail"];
  const lines = rows.map((row) => [row.when, row.client, row.contact, row.automation, row.channel, row.status, row.detail].map(csvCell).join(","));
  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

export function settingsPage(settings: PublicSettings, error: string | null, notice: string | null): string {
  const listmonkPill = settings.listmonk.connected
    ? `<span class="pill ok">● Connected</span>`
    : `<span class="pill no">● Not connected</span>`;
  const twilioPill = settings.twilio.connected
    ? `<span class="pill ok">● Connected</span>`
    : `<span class="pill no">● Not connected</span>`;
  const checked = settings.listmonk.lastCheckedAt
    ? `Last checked ${escapeHtml(formatSydney(new Date(settings.listmonk.lastCheckedAt)))}${settings.listmonk.templateCount === null ? "" : ` · ${settings.listmonk.templateCount} templates found`}`
    : "Not checked yet.";
  const tokenField = settings.listmonk.connected
    ? `<div class="secret"><span class="pill ok">Connected</span><button class="ghost" type="button" id="show-token">Replace</button><input id="token" name="apiToken" type="password" placeholder="Paste once – never shown again" hidden style="flex:1"></div>`
    : `<input name="apiToken" type="password" placeholder="Paste once – never shown again" autocomplete="off">`;
  const sidField = `<input name="accountSid" placeholder="${settings.twilio.connected ? "Saved — paste to replace" : "AC…"}" autocomplete="off">`;
  const authField = `<input name="authToken" type="password" placeholder="Paste once – never shown again" autocomplete="off">`;
  const stopOn = settings.appendReplyStop;
  return `${flash(error)}${notice ? `<div class="banner">${escapeHtml(noticeText(notice))}</div>` : ""}
<header><div><h1>Settings</h1><p class="muted" style="margin:0">Emails via listmonk · texts via Twilio · times in Sydney</p></div></header>
<div class="grid">
${mindbodyCard(settings)}
<form class="card" style="margin:0" method="post" action="/settings/listmonk"><div class="bar"><h2>✉ listmonk (email)</h2>${listmonkPill}</div>
<div class="kv"><span>Address</span><input name="baseUrl" value="${escapeHtml(settings.listmonk.baseUrl)}"><span>API user</span><input name="apiUser" value="${escapeHtml(settings.listmonk.apiUser)}" autocomplete="off"><span>API token</span>${tokenField}</div>
<p class="small muted">${checked}</p>
<div class="actions"><button class="ghost" type="submit" formaction="/settings/test/listmonk">Test connection</button><button type="submit">Save</button></div></form>
<form class="card" style="margin:0" method="post" action="/settings/twilio"><div class="bar"><h2>💬 Twilio (text)</h2>${twilioPill}</div>
<div class="kv"><span>Account SID</span>${sidField}<span>Auth token</span><div class="secret">${authField}</div><span>Sending number</span><input name="fromNumber" value="${escapeHtml(settings.twilio.fromNumber)}" placeholder="+61 4xx xxx xxx"><span>Show texts as</span><div><select name="fromMode"><option value="number"${settings.twilio.fromMode === "number" ? " selected" : ""}>Twilio number (default)</option><option value="name"${settings.twilio.fromMode === "name" ? " selected" : ""}>Sender name, e.g. BalanceMoves</option></select><div class="small muted">Using the number lets clients reply. Replies can't reach a sender name.</div></div>
<span>Sender name</span><input name="senderName" value="${escapeHtml(settings.twilio.senderName)}" placeholder="BalanceMoves">
<span>"Reply STOP" footer</span><label class="radio"><input type="checkbox" name="appendReplyStop"${stopOn ? " checked" : ""}> ${stopOn ? "On" : "Off"} <span class="muted small">(adds ~16 characters to each text)</span></label></div>
<p class="small muted">Sends use POST /Messages.json only. The number's incoming-message webhook belongs to Chatwoot, so saving here leaves the number and that webhook as they are.</p>
<div class="actions"><button class="ghost" type="submit" formaction="/settings/test/twilio">Send test text to me</button><input name="testPhone" placeholder="Your mobile" style="width:160px"><button type="submit">Save</button></div></form>
<form class="card" style="margin:0" method="post" action="/settings/from"><h2>Default "from" email</h2>
<div class="kv"><span>From name</span><input name="fromName" value="${escapeHtml(settings.defaultFromName)}"><span>From address</span><input name="fromEmail" value="${escapeHtml(settings.defaultFromEmail)}"><span>Reply-to</span><input name="replyTo" value="${escapeHtml(settings.defaultReplyTo)}"></div>
<p class="small muted">Must be verified in Amazon SES. SES is in sandbox mode: only verified addresses receive mail.</p>
<div class="actions"><button type="submit">Save</button></div></form>
<form class="card" style="margin:0" method="post" action="/settings/quiet"><h2>Quiet hours for texts</h2>
<div class="kv"><span>Don't send between</span><div style="display:flex;gap:8px;align-items:center"><input type="time" name="start" value="${escapeHtml(settings.smsQuietHours.start)}"> and <input type="time" name="end" value="${escapeHtml(settings.smsQuietHours.end)}"></div>
<span>Time zone</span><span>Australia/Sydney</span><span>During quiet hours</span><select name="quietAction"><option value="hold"${settings.quietAction === "hold" ? " selected" : ""}>Hold and send at 9:00 am</option><option value="skip"${settings.quietAction === "skip" ? " selected" : ""}>Skip the text</option></select></div>
<p class="small muted">Emails are not held.</p><div class="actions"><button type="submit">Save</button></div></form>
</div>
<p class="small muted">Tokens are stored encrypted. After saving, this page only shows Connected / Not connected. Use Replace to enter a new one.</p>
<script>document.getElementById("show-token")?.addEventListener("click",()=>{const el=document.getElementById("token");if(el){el.hidden=false;el.focus()}})</script>`;
}

function mindbodyCard(settings: PublicSettings): string {
  const usage = settings.mindbody;
  const pill = usage.atCap
    ? `<span class="pill no">● At cap</span>`
    : usage.alert
      ? `<span class="pill no">● Alert</span>`
      : `<span class="pill ok">● Within budget</span>`;
  const callers = usage.callers.length
    ? usage.callers.map((row) => `${escapeHtml(row.caller)} ${row.calls.toLocaleString("en-AU")}`).join("<br>")
    : "No calls recorded";
  return `<div class="card full" style="margin:0"><div class="bar"><h2>Mindbody API calls</h2>${pill}</div>
<div class="kv"><span>Month</span><span>${escapeHtml(monthLabel(usage.month))} (UTC)</span><span>Calls used</span><span>${usage.calls.toLocaleString("en-AU")} of ${usage.cap.toLocaleString("en-AU")}</span><span>Alert</span><span>${usage.alertAt.toLocaleString("en-AU")}</span><span>By caller</span><span>${callers}</span></div>
<p class="small muted">The free tier is 5,000 calls a month, shared. This page counts every system that writes a caller row. Optional cache refreshes stop at 5,000. Client data is reused for 6 hours.</p></div>`;
}

function monthLabel(month: string): string {
  const [year, raw] = month.split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${names[Number(raw) - 1] ?? month} ${year ?? ""}`.trim();
}

function triggerOptions(current: TriggerChoice): string {
  const options: [TriggerChoice, string][] = [
    ["daily", "Daily 9am Sydney check"],
    ["client", "New client"],
    ["sale", "Sale (Intro Pass)"],
    ["contract", "New contract"],
    ["sign-in", "Class sign-in"],
    ["booking", "Class booking"],
    ["classpass", "First ClassPass booking"],
  ];
  const rules: [TriggerChoice, string][] = [
    ["since-visit", "Days since last visit"],
    ["birthday", "On their birthday"],
    ["birthday-month", "On the 1st of their birthday month"],
    ["every-nth", "Every Nth visit"],
    ["credits", "Credits remaining"],
    ["under-credits", "Under this many credits"],
    ["visit-window", "Visit window"],
    ["lead", "External lead"],
  ];
  const head = options[0];
  const rest = options.slice(1);
  const opt = ([value, label]: [string, string]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`;
  return `${opt(head)}<optgroup label="Mindbody event">${rest.map(opt).join("")}</optgroup><optgroup label="Rule">${rules.map(opt).join("")}</optgroup>`;
}

function ruleBox(automation: Automation | null, trigger: TriggerChoice): string {
  const active = isRule(trigger) ? RULE_FIELDS[trigger] : null;
  const date = active?.input === "date";
  const value = ruleNumberValue(automation, trigger);
  return `<div id="rule-box"${active ? "" : " hidden"}><label id="rule-number-label"${date ? " hidden" : ""}><span id="rule-number-name">${escapeHtml(active && !date ? active.label : "Days")}</span><input id="rule-number" name="ruleNumber" type="number" min="0" step="1" value="${escapeHtml(value)}" style="width:88px"${date || !active ? " disabled" : ""}></label><label id="rule-date-label"${date ? "" : " hidden"}><span id="rule-date-name">${escapeHtml(active && date ? active.label : "Date")}</span><input id="rule-date" type="date"></label><p class="small muted" id="rule-help">${escapeHtml(active?.help ?? "")}</p></div>`;
}

function ruleNumberValue(automation: Automation | null, trigger: TriggerChoice): string {
  if (!automation) return trigger === "lead" ? "0" : "";
  if (trigger === "since-visit" || trigger === "lead") return String(automation.timingOffsetDays ?? 0);
  if (trigger === "every-nth") return String(automation.skipRules.everyNthVisit ?? "");
  if (trigger === "credits") return String(automation.filters.exactRemaining ?? "");
  if (trigger === "under-credits") return String((automation.filters.maxRemaining ?? 0) + 1);
  if (trigger === "visit-window") return String(automation.skipRules.visitWindowDays ?? "");
  return "";
}

function isRule(trigger: TriggerChoice): trigger is RuleTrigger {
  return trigger in RULE_FIELDS;
}

function audienceOptions(current: AudienceChoice): string {
  const options: [AudienceChoice, string][] = [
    ["intro", "Clients with an Intro Pass (2-week or 7-day)"],
    ["two-week", "Clients with a 2-week Intro Pass"],
    ["leads", "New leads"],
    ["members", "Members (contracts 11–17)"],
    ["classpass", "ClassPass clients"],
    ["all", "Any client"],
  ];
  return options.map(([value, label]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`).join("");
}

function delayOptions(current: DelayChoice): string {
  const options: [DelayChoice, string][] = [
    ["after-purchase", "days after Intro Pass purchase"],
    ["after-created", "days after client created"],
    ["before-expiry", "days before pass expiry"],
    ["after-expiry", "days after pass expiry"],
    ["after-lead", "days after an external lead"],
    ["since-last-visit", "days since last visit"],
    ["birthday", "on their birthday"],
    ["birthday-month", "on the 1st of their birthday month"],
    ["immediate", "immediately"],
  ];
  return options.map(([value, label]) => `<option value="${value}"${value === current ? " selected" : ""}>${label}</option>`).join("");
}

function logRow(row: LogView): string {
  const pill = row.channel === "sms" ? `<span class="pill text">💬 Text</span>` : `<span class="pill email">✉ Email</span>`;
  return `<tr><td data-l="When (Sydney)">${escapeHtml(row.when)}</td><td data-l="Client">${escapeHtml(row.client)}</td><td data-l="Email / phone">${escapeHtml(row.contact)}</td><td data-l="Automation">${escapeHtml(row.automation)}</td><td data-l="Channel">${pill}</td><td data-l="Status"><span class="pill ${row.status}">${row.status}</span></td><td data-l="Detail" class="muted">${escapeHtml(row.detail)}</td></tr>`;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function flash(error: string | null): string {
  if (!error) return "";
  return `<div class="err">${escapeHtml(errorText(error))}</div>`;
}

function errorText(code: string): string {
  const known: Record<string, string> = {
    template_required: "Choose a listmonk template for an email.",
    message_required: "Write the text message.",
    invalid_offset: "Delay days must be a whole number, 0 or more.",
    invalid_name: "Name is required.",
    invalid_key: "That name cannot be turned into a key.",
    not_allowlisted: "That address is not on the send allowlist.",
    quiet_hours: "Quiet hours are on. The test text was not sent.",
    twilio_not_connected: "Twilio is not connected, or no sending number is saved.",
    listmonk_not_connected: "listmonk is not connected.",
    invalid_phone: "Enter a mobile number.",
    invalid_quiet_hours: "Quiet hours must be 24-hour times, such as 20:00 and 09:00.",
    test_failed: "The test did not go through.",
    not_found: "That automation was not found.",
  };
  return known[code] ?? "Could not save that change.";
}

function noticeText(code: string): string {
  const known: Record<string, string> = {
    saved: "Saved.",
    listmonk_ok: "listmonk accepted the connection.",
    twilio_ok: "Test text sent. No client was contacted.",
    email_ok: "Test email sent to you. No client was contacted.",
  };
  return known[code] ?? "Saved.";
}

const EXAMPLE_ROWS = `<tr><td data-l="When (Sydney)">Sat 10 Oct, 9:00 am</td><td data-l="Client">Alex Example <span class="ex">example</span></td><td data-l="Email / phone">+61 400 000 101</td><td data-l="Automation">Trial day 7 – no class booked</td><td data-l="Channel"><span class="pill text">💬 Text</span></td><td data-l="Status"><span class="pill sent">sent</span></td><td data-l="Detail" class="muted">—</td></tr>
<tr><td data-l="When (Sydney)">Sat 10 Oct, 9:00 am</td><td data-l="Client">Sam Sample <span class="ex">example</span></td><td data-l="Email / phone">+61 400 000 102</td><td data-l="Automation">Trial day 7 – no class booked</td><td data-l="Channel"><span class="pill text">💬 Text</span></td><td data-l="Status"><span class="pill skipped">skipped</span></td><td data-l="Detail" class="muted">Booked a class</td></tr>
<tr><td data-l="When (Sydney)">Sat 10 Oct, 9:00 am</td><td data-l="Client">Jo Testcase <span class="ex">example</span></td><td data-l="Email / phone">jo@example.com</td><td data-l="Automation">Trial expiring 3 days</td><td data-l="Channel"><span class="pill email">✉ Email</span></td><td data-l="Status"><span class="pill sent">sent</span></td><td data-l="Detail" class="muted">—</td></tr>
<tr><td data-l="When (Sydney)">Fri 9 Oct, 6:42 pm</td><td data-l="Client">Riley Demo <span class="ex">example</span></td><td data-l="Email / phone">riley@example.com</td><td data-l="Automation">Trial welcome</td><td data-l="Channel"><span class="pill email">✉ Email</span></td><td data-l="Status"><span class="pill bounced">bounced</span></td><td data-l="Detail" class="muted">Mailbox does not exist</td></tr>
<tr><td data-l="When (Sydney)">Fri 9 Oct, 2:15 pm</td><td data-l="Client">Casey Mock <span class="ex">example</span></td><td data-l="Email / phone">+61 400 000 105</td><td data-l="Automation">Google review (text)</td><td data-l="Channel"><span class="pill text">💬 Text</span></td><td data-l="Status"><span class="pill failed">failed</span></td><td data-l="Detail" class="muted">Twilio 21614: not a mobile</td></tr>
<tr><td data-l="When (Sydney)">Fri 9 Oct, 11:03 am</td><td data-l="Client">Morgan Placeholder <span class="ex">example</span></td><td data-l="Email / phone">morgan@example.com</td><td data-l="Automation">Membership welcome</td><td data-l="Channel"><span class="pill email">✉ Email</span></td><td data-l="Status"><span class="pill sent">sent</span></td><td data-l="Detail" class="muted">—</td></tr>
<tr><td data-l="When (Sydney)">Thu 8 Oct, 9:00 pm</td><td data-l="Client">Taylor Example <span class="ex">example</span></td><td data-l="Email / phone">+61 400 000 107</td><td data-l="Automation">Trial expiring 1 day (text)</td><td data-l="Channel"><span class="pill text">💬 Text</span></td><td data-l="Status"><span class="pill skipped">skipped</span></td><td data-l="Detail" class="muted">Quiet hours – queued for 9:00 am</td></tr>
<tr><td data-l="When (Sydney)">Thu 8 Oct, 7:30 am</td><td data-l="Client">Jamie Sample <span class="ex">example</span></td><td data-l="Email / phone">jamie@example.com</td><td data-l="Automation">ClassPass welcome</td><td data-l="Channel"><span class="pill email">✉ Email</span></td><td data-l="Status"><span class="pill sent">sent</span></td><td data-l="Detail" class="muted">—</td></tr>`;
