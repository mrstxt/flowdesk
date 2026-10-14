/**
 * Sinov qo'ng'irog'i skripti (Test Call)
 *
 * Ishlatish:
 *   npx tsx test-call.ts
 */

import { config } from "dotenv";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { generateUzbekSpeechAudio, triggerTelegramCall } from "./src/lib/callService";
import * as fs from "fs";

config({ path: ".env.local" });
config();

async function main() {
  const target = process.argv[2] || process.env.TELEGRAM_TARGET_USER || "@sulaymonovss";

  console.log("=========================================");
  console.log(`📞 FLOWDESK SINOV QO'NG'IROG'I: ${target}`);
  console.log("=========================================\n");

  const apiIdStr = process.env.TELEGRAM_CALLER_API_ID;
  const apiHash = process.env.TELEGRAM_CALLER_API_HASH;
  const sessionStr = process.env.TELEGRAM_CALLER_SESSION;

  if (!apiIdStr || !apiHash || !sessionStr) {
    console.error("❌ Xatolik: .env.local da TELEGRAM_CALLER sozlamalari topilmadi!");
    process.exit(1);
  }

  const apiId = parseInt(apiIdStr, 10);
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
  });

  console.log("📲 Telegram profilingizga ulanilmoqda...");
  await client.connect();

  console.log(`🎯 Foydalanuvchi qidirilmoqda: ${target}...`);
  const entity = await client.getInputEntity(target);

  // 1. O'zbekcha audio hosil qilish (Edge TTS)
  console.log("🎙️ O'zbekcha tabiiy ovoz hosil qilinmoqda...");
  const audioText = "Assalomu alaykum Sohibjon! Bu FlowDesk tizimining sinov qo'ng'irog'i va ovozli eslatmasi. Tizim muvaffaqiyatli ulandi va ishlayapti!";
  const audioBuffer = await generateUzbekSpeechAudio(audioText);

  // 2. Chatga ovozli xabar va matn yuborish
  console.log("✉️ Chatga ovozli va matnli xabar yuborilmoqda...");
  await client.sendMessage(entity, {
    message: "🔔 <b>FlowDesk Tizimi Tayyor!</b>\n\nAssalomu alaykum! Ikkinchi profilingiz muvaffaqiyatli ulandi. Endi u sizga ertalab uyg'onish, rejalar va deadlinelar bo'yicha qo'ng'iroq qiladi!",
    parseMode: "html",
  });

  if (audioBuffer) {
    const tempFile = "temp_test_voice.mp3";
    fs.writeFileSync(tempFile, audioBuffer);
    await client.sendFile(entity, {
      file: tempFile,
      voiceNote: true,
      caption: "🎙️ Ovozli eslatma (Suhbat)",
    });
    try {
      fs.unlinkSync(tempFile);
    } catch {}
    console.log("✅ O'zbekcha ovozli xabar chatga yuborildi!");
  }

  // 3. Telegram orqali telefon qo'ng'irog'i (Ringing)
  console.log("📲 Telegram orqali to'g'ridan-to'g'ri telefon qilinmoqda...");
  const callResult = await triggerTelegramCall(target, "Sinov qo'ng'irog'i");
  console.log("Natija:", callResult.message);

  await client.disconnect();
  console.log("\n🎉 Sinov to'liq muvaffaqiyatli yakunlandi!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Xatolik:", err);
  process.exit(1);
});
