import { asString, isRecord } from "./text";

const ERROR_LINE =
  /^(?:\u2718|✘)\s*\[ERROR\]|^\[ERROR\]|^ERROR:|^Error:|^SyntaxError:|^TypeError:|^ReferenceError:/i;
const ERROR_HINT = /Module not found|Cannot find module|Build failed|Compilation failed|failed to/i;
const NOISE = [/^Total Upload:/i, /^Uploaded/i, /^Published/i, /^🌀/, /^\s*at /];

interface LogsResponse {
  result?: {
    lines?: [number, string][];
    truncated?: boolean;
    cursor?: string;
  };
}

/** One error line from a Workers Builds log. Null when the log has no clear error. */
export function extractBuildError(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? "";
    if (!line || NOISE.some((pattern) => pattern.test(line))) continue;
    if (!ERROR_LINE.test(line) && !ERROR_HINT.test(line)) continue;
    const next = lines[i + 1]?.trim() ?? "";
    const combined = next && !next.startsWith("at ") ? `${line}\n${next}` : line;
    return combined.length > 500 ? `${combined.slice(0, 500)}...` : combined;
  }
  return null;
}

/**
 * Optional. The Workers Builds event does not include the log line.
 * A read token in CLOUDFLARE_API_TOKEN (not a required secret) loads it.
 * Failures here return no lines so the alert still posts.
 */
export async function fetchBuildLogs(body: unknown, env: Env): Promise<string[]> {
  const token = optionalBuildsToken(env);
  if (!token || !isRecord(body)) return [];
  const payload = isRecord(body.payload) ? body.payload : null;
  const metadata = isRecord(body.metadata) ? body.metadata : null;
  const accountId = asString(metadata?.accountId);
  const buildUuid = asString(payload?.buildUuid);
  if (!accountId || !buildUuid) return [];

  const lines: string[] = [];
  let cursor = "";
  try {
    for (let page = 0; page < 2; page++) {
      const url = new URL(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/builds/builds/${buildUuid}/logs`,
      );
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return lines;
      const data = (await response.json()) as LogsResponse;
      const chunk = data.result?.lines?.map((entry) => entry[1]) ?? [];
      lines.push(...chunk);
      if (!data.result?.truncated || !data.result.cursor) break;
      cursor = data.result.cursor;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "log fetch failed";
    console.error(JSON.stringify({ source: "builds", result: "logs_unavailable", error: message }));
  }
  return lines;
}

function optionalBuildsToken(env: Env): string {
  const value = (env as Env & { CLOUDFLARE_API_TOKEN?: string }).CLOUDFLARE_API_TOKEN;
  return value?.trim() ?? "";
}
