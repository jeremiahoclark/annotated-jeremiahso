import { APP_ORIGIN } from "../config";
import { me } from "./api-client";
import type { StoredAuth } from "./types";

const TOKEN_KEY = "token";
const USER_KEY = "user";

export async function getStoredAuth(): Promise<StoredAuth | null> {
  const result = await chrome.storage.local.get([TOKEN_KEY, USER_KEY]);
  const token = result[TOKEN_KEY] as string | undefined;
  const user = result[USER_KEY] as StoredAuth["user"] | undefined;
  if (token && user) return { token, user };
  return null;
}

export async function setStoredAuth(auth: StoredAuth): Promise<void> {
  await chrome.storage.local.set({
    [TOKEN_KEY]: auth.token,
    [USER_KEY]: auth.user,
  });
}

export async function clearStoredAuth(): Promise<void> {
  await chrome.storage.local.remove([TOKEN_KEY, USER_KEY]);
}

/**
 * OAuth / web auth via chrome.identity.launchWebAuthFlow.
 * Expects redirect URL containing /auth/extension/complete?token=...
 */
export async function launchProviderAuth(
  provider: "google" | "twitter" | "email"
): Promise<StoredAuth> {
  const redirectUrl = chrome.identity.getRedirectURL();
  const start = new URL(`${APP_ORIGIN}/auth/extension/start`);
  start.searchParams.set("provider", provider);
  start.searchParams.set("redirect_uri", redirectUrl);

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: start.toString(),
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("Sign-in was cancelled.");
  }

  const token = parseTokenFromRedirect(responseUrl);
  if (!token) {
    throw new Error("No token in auth redirect. Try again.");
  }

  // Hydrate user profile from /api/me
  let user: StoredAuth["user"] = { handle: "you", display_name: null };
  try {
    const profile = await me(token);
    user = {
      handle: profile.handle,
      display_name: profile.display_name,
      id: profile.id,
      avatar_url: profile.avatar_url,
    };
  } catch {
    // Token present; profile optional for session store
  }

  const auth: StoredAuth = { token, user };
  await setStoredAuth(auth);
  return auth;
}

export function parseTokenFromRedirect(responseUrl: string): string | null {
  try {
    const u = new URL(responseUrl);
    // Prefer query
    let token = u.searchParams.get("token");
    if (token) return token;
    // Hash fragment ? or #token=
    if (u.hash) {
      const hash = u.hash.replace(/^#/, "");
      const params = new URLSearchParams(
        hash.startsWith("?") ? hash.slice(1) : hash.includes("=") ? hash : `token=${hash}`
      );
      token = params.get("token");
      if (token) return token;
    }
    // Path style .../complete?token= already covered; also match raw
    const m = /[?&#]token=([^&]+)/.exec(responseUrl);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    const m = /[?&#]token=([^&]+)/.exec(responseUrl);
    return m ? decodeURIComponent(m[1]) : null;
  }
}

export async function signOut(): Promise<void> {
  await clearStoredAuth();
}
