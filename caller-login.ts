/**
 * Ikkinchi profilni (Userbot) ulash skripti.
 *
 * Ishlatish:
 *   npx tsx caller-login.ts
 *
 * my.telegram.org dan olingan API_ID va API_HASH kiritiladi,
 * SMS kodi tasdiqlangach sessiya avtomatik .env.local ga saqlanadi.
 */

import { config } from "dotenv";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import * as readline from "readline";
import * as fs from "fs";

config({ path: ".env.local" });
config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ask = (query: string): Promise<string> =>
  new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log("=========================================");
  console.log("📞 FLOWDESK TELEGRAM QO'NG'IROQCHI BOT");
  console.log("=========================================\n");

  let apiIdStr = process.env.TELEGRAM_CALLER_API_ID;
  let apiHash = process.env.TELEGRAM_CALLER_API_HASH;

  if (!apiIdStr || !apiHash) {
    console.log("my.telegram.org dan olgan ma'lumotlaringizni kiriting:\n");
    apiIdStr = await ask("1. API_ID: ");
    apiHash = await ask("2. API_HASH: ");
  }

  const apiId = parseInt(apiIdStr.trim(), 10);
  if (isNaN(apiId)) {
    console.error("❌ Xatolik: API_ID raqam bo'lishi kerak!");
    process.exit(1);
  }

  const stringSession = new StringSession("");
  const client = new TelegramClient(stringSession, apiId, apiHash.trim(), {
    connectionRetries: 5,
  });

  console.log("\n📲 Telegram profilingizga ulanilmoqda...");

  await client.start({
    phoneNumber: async () => {
      const raw = await ask("Ikkinchi profil telefon raqami (masalan: +998901234567): ");
      let cleaned = raw.trim().replace(/[^0-9+]/g, "");
      if (!cleaned.startsWith("+")) {
        cleaned = `+${cleaned}`;
      }
      console.log(`➡️ Qabul qilingan format: ${cleaned}`);
      return cleaned;
    },
    password: async () => {
      const pwd = await ask("Ikki bosqichli parol (agar bo'lsa kiriting, yo'q bo'lsa shunchaki Enter bosing): ");
      return pwd.trim();
    },
    phoneCode: async () => {
      const code = await ask("Telegram ilovasiga kelgan kod: ");
      return code.trim().replace(/[^0-9]/g, "");
    },
    onError: (err) => console.error("Xatolik:", err.message),
  });

  const me = await client.getMe();
  const sessionString = client.session.save() as unknown as string;

  console.log(`\n✅ Muvaffaqiyatli ulandi!`);
  console.log(`Foydalanuvchi: ${me.firstName} (@${me.username || "username_yoq"})`);

  // .env.local ga yozib qo'yamiz
  const envPath = ".env.local";
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const updates: Record<string, string> = {
    TELEGRAM_CALLER_API_ID: String(apiId),
    TELEGRAM_CALLER_API_HASH: apiHash.trim(),
    TELEGRAM_CALLER_SESSION: sessionString,
  };

  for (const [key, val] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${val}`);
    } else {
      envContent += `\n${key}=${val}`;
    }
  }

  fs.writeFileSync(envPath, envContent.trim() + "\n");
  console.log("💾 Ma'lumotlar .env.local fayliga muvaffaqiyatli saqlandi!");
  console.log("Endi bot avtomatik qo'ng'iroq qila oladi! 🎉\n");

  await client.disconnect();
  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Xatolik yuz berdi:", err);
  rl.close();
  process.exit(1);
});

