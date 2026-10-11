import {
  callbackRedirectUri,
  clearOauthStateCookie,
  clearSessionCookie,
  createSessionToken,
  googleAuthUrl,
  googleConfigured,
  isAdminEmail,
  oauthStateCookie,
  readOauthState,
  sessionCookie,
} from "../auth";
import { timingSafeEqualString } from "../crypto-equal";
import type { RuntimeConfig } from "../env";
import { signInPage } from "./html";

export async function startGoogleLogin(config: RuntimeConfig, origin: string): Promise<Response> {
  if (!googleConfigured(config)) return html(signInPage({ configured: false, error: "Google login is not configured." }));
  const state = crypto.randomUUID();
  const location = googleAuthUrl(config.googleClientId, callbackRedirectUri(origin), state);
  return new Response(null, { status: 302, headers: { Location: location, "Set-Cookie": oauthStateCookie(state) } });
}

export async function finishGoogleLogin(request: Request, config: RuntimeConfig, url: URL, fetchImpl: typeof fetch): Promise<Response> {
  const expected = readOauthState(request.headers.get("Cookie"));
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const fail = (error: string) => {
    const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    headers.append("Set-Cookie", clearOauthStateCookie());
    headers.append("Set-Cookie", clearSessionCookie());
    return new Response(signInPage({ configured: true, error }), { headers });
  };
  if (!googleConfigured(config)) return fail("Google login is not configured.");
  if (!code || !state || !expected || !(await timingSafeEqualString(state, expected))) {
    return fail("Google sign-in was cancelled or the session expired. Try again.");
  }
  const tokenRes = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: callbackRedirectUri(url.origin),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("Google did not accept this login. Check the OAuth client and redirect URI.");
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return fail("Google did not return an access token.");
  const userRes = await fetchImpl("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) return fail("Could not read the Google account.");
  const user = (await userRes.json()) as { email?: string; email_verified?: boolean };
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email || user.email_verified === false) return fail("That Google account has no verified email.");
  if (!isAdminEmail(email, config.adminEmails)) return fail("This Google account is not on the admin list.");
  const token = await createSessionToken(config.sessionSecret, email);
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", sessionCookie(token));
  headers.append("Set-Cookie", clearOauthStateCookie());
  return new Response(null, { status: 302, headers });
}

export function html(body: string, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(body, { headers });
}
