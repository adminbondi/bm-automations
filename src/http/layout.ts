const TASKS_URL = "https://mb-task-dashboard.plain-bush-daad.workers.dev/";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function adminPage(options: {
  title: string;
  email: string;
  active: "automations" | "log" | "settings";
  body: string;
  script?: string;
}): string {
  const person = displayPerson(options.email);
  const nav = (id: typeof options.active, href: string, icon: string, label: string) =>
    `<a href="${href}" class="${options.active === id ? "on" : ""}"><span>${icon}</span>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(options.title)} · Balance Moves</title><style>${CSS}</style></head><body>
<div class="topm"><button class="ghost" type="button" onclick="document.body.classList.toggle('menu')">☰ Menu</button><b>Balance Moves admin</b></div>
<aside class="side"><div class="rail"><div class="brand">Balance Moves<div class="muted small">Admin</div></div><nav>
<a href="${TASKS_URL}"><span>☰</span>Tasks</a>
${nav("automations", "/automations", "⚡", "Automations")}
${nav("log", "/log", "📋", "Send log")}
${nav("settings", "/settings", "⚙", "Settings")}
</nav>
<div class="foot"><div class="user"><div class="avatar">${escapeHtml(person.initials)}</div><div class="small"><div>${escapeHtml(person.label)}</div><div class="muted">${escapeHtml(options.email)}</div></div></div>
<form method="post" action="/logout"><button class="ghost" type="submit" style="width:100%;margin-top:10px">Sign out</button></form></div></div></aside>
<main class="wrap">${options.body}</main>${options.script ? `<script>${options.script}</script>` : ""}</body></html>`;
}

function displayPerson(email: string): { initials: string; label: string } {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  const initials = (parts.length >= 2 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : local.slice(0, 2)).toUpperCase();
  const label = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || email;
  return { initials, label };
}

const CSS = `:root{color-scheme:light;--ink:#1c1917;--muted:#78716c;--line:#e7e5e4;--bg:#fafaf9;--card:#fff;--accent:#0f766e;--sms:#6d28d9}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--bg)}
.wrap{max-width:1180px;margin:0 auto;padding:32px 20px 64px}h1{font-size:1.4rem;margin:0 0 8px}h2{font-size:1.05rem;margin:0 0 6px}
.muted{color:var(--muted)}.small{font-size:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:22px;margin-bottom:16px}
.btn,button{display:inline-block;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:9px 16px;font:inherit;font-size:14px;text-decoration:none;cursor:pointer;white-space:nowrap}
.btn.ghost,button.ghost{background:#fff;color:var(--ink);border:1px solid var(--line)}
button.plain{background:transparent;color:inherit;border:0;padding:0;border-radius:0}
header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap}
html,body{min-height:100%}body{position:relative;min-height:100vh;padding-left:220px}
.side{position:fixed;top:0;bottom:0;left:0;width:220px;height:100vh;overflow:auto;background:#fff;border-right:1px solid var(--line);z-index:5}
.rail{min-height:100%;display:flex;flex-direction:column;padding:22px 14px;background:#fff}
.brand{font-weight:700;color:var(--accent);padding:0 10px 18px}nav{display:flex;flex-direction:column;gap:2px;flex:1}nav a{display:flex;gap:10px;padding:9px 12px;border-radius:10px;color:var(--ink);text-decoration:none}nav a:hover{background:#f5f5f4}nav a.on{background:#ccfbf1;color:var(--accent);font-weight:600}.foot{border-top:1px solid var(--line);padding-top:14px}.topm{display:none}
.user{display:flex;align-items:center;gap:10px}.avatar{width:32px;height:32px;border-radius:50%;background:#ccfbf1;color:#0f766e;display:grid;place-items:center;font-weight:600;font-size:13px}
.bar{display:flex;justify-content:space-between;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end}
label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--muted)}
select,input,textarea{font:inherit;color:var(--ink);padding:7px 9px;border-radius:8px;border:1px solid var(--line);background:#fff}textarea{min-height:150px;resize:vertical;width:100%}
.table-wrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);white-space:nowrap}td.prev{max-width:300px;color:var(--muted)}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;background:#e7e5e4;font-size:12px;white-space:nowrap}
.pill.email{background:#ccfbf1;color:#115e59}.pill.text{background:#ede9fe;color:#5b21b6}
.pill.sent{background:#dcfce7;color:#166534}.pill.skipped{background:#fef3c7;color:#92400e}.pill.failed,.pill.bounced{background:#fee2e2;color:#991b1b}
.pill.ok{background:#dcfce7;color:#166534}.pill.no{background:#fee2e2;color:#991b1b}.ex{background:#fef3c7;color:#92400e;font-size:11px;padding:1px 6px;border-radius:6px}
.banner{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:14px}
.sw{position:relative;display:inline-block;width:38px;height:22px;border-radius:999px;background:#d6d3d1;vertical-align:middle}.sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s}
.sw.on{background:var(--accent)}.sw.on::after{left:19px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.full{grid-column:1/-1}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;width:max-content}.seg span{padding:7px 16px;color:var(--muted);cursor:pointer}.seg span.on{background:var(--accent);color:#fff}
.seg label{padding:7px 16px;color:var(--muted);cursor:pointer;margin:0;font-size:15px}
.seg input{position:absolute;opacity:0;width:1px;height:1px}
.seg label:has(input:checked){background:var(--accent);color:#fff}
.radio{flex-direction:row;align-items:center;gap:8px;color:var(--ink);font-size:14px}
.preview{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#f5f5f4}.preview .hd{padding:8px 12px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--line);background:#fff}
.mail{background:#fff;margin:14px;border-radius:8px;padding:18px;font-size:13px}.mail .logo{font-weight:700;letter-spacing:.08em;color:var(--accent);margin-bottom:10px}
.counter{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:6px;gap:12px}
.bubble{background:#e9e9eb;border-radius:18px;padding:10px 14px;max-width:290px;font-size:13px;white-space:pre-wrap}
.kv{display:grid;grid-template-columns:150px 1fr;gap:10px 14px;align-items:center;font-size:14px}.kv input,.kv select{width:100%}
.secret{display:flex;gap:8px;align-items:center}.actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:8px}
details.unused{margin-top:16px;background:#fff;border:1px solid var(--line);border-radius:12px}
details.unused summary{cursor:pointer;padding:12px 14px;font-weight:600}
details.unused summary .muted{font-weight:400;margin-left:6px}
details.unused .table-wrap{border:0;border-top:1px solid var(--line);border-radius:0}
#rule-box{margin-top:8px}
.err{background:#fee2e2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;margin-bottom:14px}
a.name{color:var(--ink);font-weight:600}
@media(max-width:760px){body{padding-left:0}.topm{display:flex;gap:12px;align-items:center;padding:10px 12px;background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:6}.side{position:fixed;top:53px;bottom:0;height:auto;transform:translateX(-100%);transition:.2s;box-shadow:0 8px 30px #0002}.rail{height:100%;position:relative;overflow:auto}body.menu .side{transform:none}.wrap{padding:18px 12px 48px;max-width:100%}.grid{grid-template-columns:1fr}.grid>*,.card{min-width:0}select,input,textarea{max-width:100%}.kv{grid-template-columns:1fr;gap:4px}
 table.cards thead{display:none}table.cards tr{display:block;border-bottom:1px solid var(--line);padding:8px 4px}table.cards td{display:flex;justify-content:space-between;gap:12px;border:0;padding:3px 8px}
 table.cards td::before{content:attr(data-l);font-size:11px;text-transform:uppercase;color:var(--muted)}td.prev{max-width:none}.hide-m{display:none!important}}`;
