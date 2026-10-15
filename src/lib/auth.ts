/**
 * FlowDesk autentifikatsiya yordamchisi.
 *
 * - Parolni tekshiradi (ADMIN_PASSWORD, Belgisiz SESSION_SECRET).
 * - Imzolangan (HMAC-SHA256) sessiya tokeni yaratadi/tekshiradi.
 * - Web Crypto (crypto.subtle) ishlatilgani uchun ham Node runtime,
 *   ham Edge/proxy runtime da ishlaydi (node:crypto ishlatilmaydi).
 */

const encoder = new TextEncoder();
const SESSION_COOKIE = "fd_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 kun

export { SESSION_COOKIE };

/** Auth sozlanganmi? (parol yoki session secret mavjudmi) */
export function getAuthSecret(): string | null {
  const s = process.env.ADMIN_PASSWORD || process.env.SESSION_SECRET || "";
  return s.length >= 6 ? s : null;
}

export function isAuthConfigured(): boolean {
  return Boolean(getAuthSecret());
}

/** Tashqi API (agent/external-sync) uchun x-api-key */
export function getApiKey(): string | null {
  const k = process.env.API_KEY || "";
  return k.length >= 8 ? k : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 =
    typeof btoa === "function"
      ? btoa(bin)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  return s.replace(/-/g, "+").replace(/_/g, "/");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(new Uint8Array(sig));
}

/** O'zgaruvchisiz (constant-time) solishtirish */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Parol to'g'rimi? (constant-time) */
export async function verifyPassword(password: string): Promise<boolean> {
  const secret = getAuthSecret();
  if (!secret) return false;
  const adminPassword = process.env.ADMIN_PASSWORD || secret;
  const [a, b] = await Promise.all([
    hmac(secret, `pwd:${password}`),
    hmac(secret, `pwd:${adminPassword}`),
  ]);
  return safeEqual(a, b);
}

/** Imzolangan sessiya tokeni yaratadi */
export async function createSessionToken(): Promise<string> {
  const secret = getAuthSecret();
  if (!secret) throw new Error("ADMIN_PASSWORD yoki SESSION_SECRET o'rnatilmagan");
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmac(secret, `sess:${exp}`);
  return `${exp}.${sig}`;
}

/** Token haqiqimi va muddati tugamaganmi? */
export async function verifySessionToken(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = getAuthSecret();
  if (!secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false;
  const expected = await hmac(secret, `sess:${exp}`);
  return safeEqual(fromBase64Url(sig), fromBase64Url(expected));
}

/** Cookie qatoridan sessiya tokenini ajratadi */
export function getTokenFromCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/** So'rov autentifikatsiyadan o'tganmi? (cookie YOKI x-api-key) */
export async function isAuthorized(headers: Headers): Promise<boolean> {
  if (await verifySessionToken(getTokenFromCookieHeader(headers.get("cookie")))) {
    return true;
  }
  const apiKey = getApiKey();
  const given = headers.get("x-api-key");
  if (apiKey && given) return safeEqual(given, apiKey);
  return false;
}
