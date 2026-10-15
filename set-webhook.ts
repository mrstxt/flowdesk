/**
 * Telegram bot webhook'ini ro'yxatdan o'tkazish.
 *
 * Ishlatish:
 *   npm run bot:webhook                      # PUBLIC_APP_URL yoki APP_URL dan
 *   npx tsx set-webhook.ts https://domain.com
 *
 * Muhim: `BOT_WEBHOOK_SECRET` o'rnatilsa, Telegram shu satrni
 * `x-telegram-bot-api-secret-token` headerida yuboradi va
 * /api/bot route'i uni tekshiradi.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SECRET = process.env.BOT_WEBHOOK_SECRET || "";
const BASE_URL =
  process.argv[2] ||
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.VERCEL_URL ||
  "";

async function main() {
  if (!TOKEN) {
    console.error("❌ TELEGRAM_BOT_TOKEN o'rnatilmagan (.env.local)");
    process.exit(1);
  }
  if (!BASE_URL) {
    console.error(
      "❌ Backend manzil kerak: `npx tsx set-webhook.ts https://sizning-domen.com`"
    );
    process.exit(1);
  }

  const url = `${BASE_URL.replace(/\/$/, "")}/api/bot`;
  const body: Record<string, unknown> = {
    url,
    drop_pending_updates: false,
    allowed_updates: ["message", "callback_query"],
  };
  if (SECRET) body.secret_token = SECRET;

  const res = await fetch(
    `https://api.telegram.org/bot${TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  const data = (await res.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    console.error("❌ setWebhook xatosi:", data.description);
    process.exit(1);
  }
  console.log("✅ Webhook o'rnatildi:", url);
  if (!SECRET) {
    console.log(
      "⚠️  BOT_WEBHOOK_SECRET bo'sh — webhook ochiq. Uni .env.local ga qo'shing va qayta ishga tushiring."
    );
  }

  const info = await fetch(
    `https://api.telegram.org/bot${TOKEN}/getWebhookInfo`
  );
  const infoData = (await info.json()) as {
    ok: boolean;
    result?: { url?: string; pending_update_count?: number; last_error_message?: string };
  };
  if (infoData.ok && infoData.result) {
    console.log("ℹ️  Holat:", JSON.stringify(infoData.result, null, 2));
  }
}

main().catch((e) => {
  console.error("❌ Xatolik:", e.message);
  process.exit(1);
});
