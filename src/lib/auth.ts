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

export function missingAuthEnv(): string[] {
  if (process.env.NODE_ENV !== "production") return [];
  return ["SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_OTP_SECRET"].filter(
    (name) => !process.env[name]
  );
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

function otpSecret(): string {
  return requiredEnv("ADMIN_OTP_SECRET", "JBSWY3DPEHPK3PXP");
}

function base32ToBytes(secret: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

async function hotp(secret: string, counter: number): Promise<string> {
  const secretBytes = base32ToBytes(secret);
  const secretBuffer = secretBytes.buffer.slice(
    secretBytes.byteOffset,
    secretBytes.byteOffset + secretBytes.byteLength
  ) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    secretBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
  const offset = sig[sig.length - 1] & 0xf;
  const code =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

async function verifyOtp(code: string): Promise<boolean> {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;

  const step = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [-1, 0, 1]) {
    if ((await hotp(otpSecret(), step + drift)) === clean) return true;
  }
  return false;
}

export async function createCaptchaChallenge(): Promise<{
  question: string;
  token: string;
}> {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  const answer = String(a + b);
  const exp = Date.now() + 5 * 60 * 1000;
  const nonce = crypto.randomUUID();
  const payload = `${exp}.${nonce}`;
  const sig = await hmac(`${payload}.${answer}`, sessionSecret());

  return {
    question: `${a} + ${b} = ?`,
    token: `${payload}.${sig}`,
  };
}

export async function verifyCaptchaChallenge(
  token: string,
  answer: string
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  if (Date.now() > Number(expStr)) return false;

  const cleanAnswer = answer.trim();
  const expected = await hmac(
    `${expStr}.${nonce}.${cleanAnswer}`,
    sessionSecret()
  );
  if (expected.length !== sig.length) return false;

  let ok = 0;
  for (let i = 0; i < sig.length; i++) {
    ok |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return ok === 0;
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

export async function checkOneTimeLogin(
  username: string,
  otp: string
): Promise<boolean> {
  const u = requiredEnv("ADMIN_USERNAME", "admin");
  return username === u && (await verifyOtp(otp));
}
