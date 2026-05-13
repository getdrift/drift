// Edge-runtime-safe auth helpers. Uses Web Crypto, no node:crypto.

const COOKIE_NAME = "drift_session";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE_SECONDS = Math.floor(MAX_AGE_MS / 1000);

export function authDisabled(): boolean {
  return !(process.env.DRIFT_PASSWORD ?? "").trim();
}

export function checkPassword(input: string): boolean {
  const expected = (process.env.DRIFT_PASSWORD ?? "").trim();
  if (!expected) return false;
  return constantTimeEqual(input, expected);
}

interface SessionPayload {
  user: string;
  exp: number;
}

export async function signSession(user: string): Promise<string> {
  const payload: SessionPayload = { user, exp: Date.now() + MAX_AGE_MS };
  const payloadJson = JSON.stringify(payload);
  const sig = await hmacHex(payloadJson);
  return base64UrlEncode(payloadJson) + "." + sig;
}

export async function verifySession(
  token: string | undefined,
): Promise<{ user: string } | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payloadJson: string;
  try {
    payloadJson = base64UrlDecode(payloadB64);
  } catch {
    return null;
  }
  const expected = await hmacHex(payloadJson);
  if (!constantTimeEqual(sig, expected)) return null;
  let payload: SessionPayload;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.user !== "string" || !payload.user) return null;
  return { user: payload.user };
}

async function hmacHex(message: string): Promise<string> {
  const secret = process.env.DRIFT_AUTH_SECRET || "drift-default-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return toHex(new Uint8Array(sig));
}

function toHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i].toString(16);
    s += b.length === 1 ? "0" + b : b;
  }
  return s;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
