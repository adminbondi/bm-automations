export function signInPage(options: { configured: boolean; error?: string }): string {
  const error = options.error ? `<p class="error">${escapeHtml(options.error)}</p>` : "";
  const action = options.configured
    ? `<a class="btn" href="/login">Sign in with Google</a>`
    : `<p class="muted">Google login is not configured yet. Add <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, <code>SESSION_SECRET</code>, and <code>ADMIN_EMAILS</code>.</p>`;
  return layout(
    "Balance Moves automations",
    `<main class="card">
      <p class="eyebrow">Balance Moves</p>
      <h1>Automations</h1>
      <p>Sign in with a Google account on the admin allowlist. Automation screens are waiting on design approval. The API stays at <code>/admin</code>.</p>
      ${error}
      ${action}
    </main>`,
  );
}

export function signedInPage(email: string): string {
  return layout(
    "Balance Moves automations",
    `<main class="card">
      <p class="eyebrow">Balance Moves</p>
      <h1>Signed in</h1>
      <p>You are signed in as ${escapeHtml(email)}. Automation screens are waiting on design approval, so this page does not list or edit them.</p>
      <p class="muted">JSON lives under <code>/admin</code>.</p>
      <form method="post" action="/logout"><button type="submit">Sign out</button></form>
    </main>`,
  );
}

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ink: #1c1915; --muted: #5c564c; --line: #e4ddd2; --paper: #f7f3ec; --card: #fffdf9; --accent: #8c3d2f; }
    * { box-sizing: border-box; }
    body { margin: 0; font: 16px/1.5 "Iowan Old Style", Palatino, Georgia, serif; color: var(--ink); background: var(--paper); }
    .wrap { max-width: 36rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 1.5rem; }
    .eyebrow { margin: 0 0 0.25rem; letter-spacing: 0.08em; text-transform: uppercase; font: 600 0.75rem/1.2 ui-sans-serif, system-ui, sans-serif; color: var(--accent); }
    h1 { margin: 0 0 0.75rem; font-size: 2rem; }
    p { margin: 0 0 1rem; }
    .muted { color: var(--muted); }
    .error { color: var(--accent); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.9em; }
    .btn, button { display: inline-block; background: var(--accent); color: white; text-decoration: none; border: 0; border-radius: 999px; padding: 0.7rem 1.1rem; font: 600 0.95rem/1 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
  </style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    if (ch === ">") return "&gt;";
    if (ch === '"') return "&quot;";
    return "&#39;";
  });
}
