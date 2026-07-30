const SESSION_DAYS = 7;

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV !== "production" && fallback) return fallback;
  throw new Error(`${name} is required`);
}

function sessionSecret(): string {
  return requiredEnv("SESSION_SECRET", "flowdesk-local-dev-secret-change-me");
}

async function hmac(data: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000;
  const payload = String(exp);
  return `${payload}.${await hmac(payload, sessionSecret())}`;
}

export async function verifyToken(
  token?: string | null
): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [expStr, sig] = parts;
  const expected = await hmac(expStr, sessionSecret());
  if (expected.length !== sig.length) return false;
  let ok = 0;
  for (let i = 0; i < sig.length; i++) {
    ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  if (ok !== 0) return false;
  return Date.now() < Number(expStr);
}

export function checkCredentials(username: string, password: string): boolean {
  const u = requiredEnv("ADMIN_USERNAME", "admin");
  const p = requiredEnv("ADMIN_PASSWORD", "admin123");
  return username === u && password === p;
}
