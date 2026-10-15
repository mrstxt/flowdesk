/**
 * Oddiy in-memory rate limiter (har bir server instance uchun).
 *
 * Eslatma: Vercel serverless da har bir instance alohida hisoblaydi,
 * shuning uchun bu limiter "best effort" himoya — asosiy vazifasi
 * botlar/skriptlarning Gemini API ni sarf qilishini sekinlashtirish.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type LimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): LimitResult {
  const now = Date.now();

  // Xotira oshib ketmasligi uchun eskirgan yozuvlarni tozalash
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    ok: true,
    remaining: limit - bucket.count,
    retryAfterSec: 0,
  };
}

/** So'rov keldigan IP manzil (proxy orqali bo'lsa x-forwarded-for) */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/** 429 javobini qaytarish uchun yordamchi */
export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      error: "So'rovlar juda ko'p. Birozdan keyin qayta urinib ko'ring.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
