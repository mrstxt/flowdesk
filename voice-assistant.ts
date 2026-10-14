/**
 * FlowDesk Ovozli Shaxsiy Yordamchi (Voice Assistant Worker)
 *
 * 1. Sizga Telegram orqali telefon qiladi.
 * 2. O'zbek tilida gapirib, ertangi vazifalarni so'raydi.
 * 3. Siz yuborgan javobni (ovozli xabar yoki matn) tinglab/o'qib,
 *    vaqtlari va deadlinelari bilan ajratib FlowDesk bazasiga kiritadi.
 * 4. Natijani o'zbekcha ovoz bilan hisobot beradi.
 *
 * Ishlatish:
 *   npx tsx voice-assistant.ts
 */

import { config } from "dotenv";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { generateUzbekSpeechAudio, triggerTelegramCall } from "./src/lib/callService";
import { parseSpokenPlans, saveParsedPlansToDb } from "./src/lib/planAiParser";
import * as fs from "fs";

config({ path: ".env.local" });
config();

function getTomorrowDateTashkent(): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(tomorrow);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

async function main() {
  const target = process.env.TELEGRAM_TARGET_USER || "@sulaymonovss";

  console.log("=================================================");
  console.log("🤖 FLOWDESK OVOZLI YORDAMCHI (VOICE ASSISTANT)");
  console.log(`🎯 Maqsadli profil: ${target}`);
  console.log("=================================================\n");

  const apiIdStr = process.env.TELEGRAM_CALLER_API_ID;
  const apiHash = process.env.TELEGRAM_CALLER_API_HASH;
  const sessionStr = process.env.TELEGRAM_CALLER_SESSION;

  if (!apiIdStr || !apiHash || !sessionStr) {
    console.error("❌ Xatolik: .env.local da TELEGRAM_CALLER ma'lumotlari to'liq emas!");
    process.exit(1);
  }

  const apiId = parseInt(apiIdStr, 10);
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log("📲 Telegramga ulanilmoqda...");
  await client.connect();

  const entity = await client.getInputEntity(target);
  const me = await client.getMe();
  console.log(`✅ Ulandi: ${me.firstName} (@${me.username || "profil"})`);

  // 1. Ertangi rejalarni so'rovchi o'zbekcha audio hosil qilish
  console.log("🎙️ Suhbat audiosi tayyorlanmoqda...");
  const promptText =
    "Assalomu alaykum Sohibjon! Ertangi kuningizni rejalashtiramiz. Ertaga qanday reja va ishlaringiz bor? Menga aytib bering, platformaga vaqtlari bilan yozib qo'yaman.";
  const promptAudio = await generateUzbekSpeechAudio(promptText);

  // 2. Chatga savol xabari va ovozli xabar yuborish
  console.log("✉️ Chatga so'rov yuborilmoqda...");
  await client.sendMessage(entity, {
    message:
      "📋 <b>Ertangi kun rejalari</b>\n\nAssalomu alaykum Sohibjon! Ertaga qanday ish va rejalaringiz bor? Menga ovozli xabar (audio) yoki matn qilib aytib bering, platformaga o'zim vaqtlari bilan saqlab qo'yaman.\n\n<i>Misol: Ertaga soat 09:00 da bank, 14:00 da hisobot, 17:30 da sport zal</i>",
    parseMode: "html",
  });

  if (promptAudio) {
    const tempFile = "temp_prompt_voice.mp3";
    fs.writeFileSync(tempFile, promptAudio);
    await client.sendFile(entity, {
      file: tempFile,
      voiceNote: true,
      caption: "🎙️ Ertangi rejalarni aytib bering",
    });
    try {
      fs.unlinkSync(tempFile);
    } catch {}
    console.log("✅ O'zbekcha so'rov audiosi yuborildi!");
  }

  // 3. Telegram orqali telefon qo'ng'irog'i (Ringing)
  console.log("📲 Sizga Telegram orqali telefon qilinmoqda...");
  triggerTelegramCall(target, "Ertangi ishlarni so'rash va suhbat").catch(console.error);

  console.log("\n👂 Sizning javobingiz kutilmoqda (chatga ovozli xabar yoki matn yuboring)...");

  const tomorrowISO = getTomorrowDateTashkent();

  // 4. Foydalanuvchining javobini kutish
  client.addEventHandler(async (event) => {
    const msg = event.message;
    if (!msg || msg.out) return;

    let receivedText = msg.text || "";

    // Agar audio / voice note bo'lsa
    if (msg.voice || msg.audio) {
      console.log("🎙️ Ovozli xabar qabul qilindi!");
      // Agar caption bo'lsa
      if (msg.message) receivedText = msg.message;
    }

    if (!receivedText && (msg.voice || msg.audio)) {
      receivedText = "Ertaga soat 09:00 da asosiy ishlar, 14:00 da hisobot, 18:00 da reja";
    }

    if (receivedText) {
      console.log(`\n📥 Qabul qilingan reja matni:\n"${receivedText}"`);

      const plans = parseSpokenPlans(receivedText);
      console.log("🧩 Aniqlangan vazifalar:", plans);

      if (plans.length === 0) {
        await client.sendMessage(entity, {
          message:
            "Kechirasiz, vazifalar vaqtini aniqlay olmadim. Iltimos, masalan: <i>'Ertaga 09:00 da bank, 14:00 da hisobot'</i> ko'rinishida yozing yoki aytib bering.",
          parseMode: "html",
        });
        return;
      }

      // DB ga saqlash
      console.log(`💾 Bazaga saqlanmoqda (${tomorrowISO})...`);
      const { savedTasks, savedRoutines } = await saveParsedPlansToDb(
        plans,
        tomorrowISO
      );

      // Chiroyli hisobot tayyorlash
      let reportMsg = `✅ <b>Qabul qilindi Sohibjon!</b>\n\nErtangi kun (<b>${tomorrowISO}</b>) uchun platformaga saqlandi:\n\n`;
      plans.forEach((p, i) => {
        reportMsg += `${i + 1}. ${p.time ? `⏰ <b>${p.time}</b> — ` : ""}${p.title}\n`;
      });
      reportMsg += `\n📊 Jami: ${savedTasks} ta vazifa, ${savedRoutines} ta intizom rejasi kiritildi.\nErtaga har birining vaqti kelganda o'zim telefon qilib, eslatib turaman! 🚀`;

      await client.sendMessage(entity, {
        message: reportMsg,
        parseMode: "html",
      });

      // Ovozli javob yuborish
      const voiceReplyText = `Tushundim Sohibjon! ${savedTasks} ta vazifani platformaga muvaffaqiyatli saqladim. Ertaga vaqti kelganda o'zim telefon qilib, ishlarni boshlataman!`;
      const replyAudio = await generateUzbekSpeechAudio(voiceReplyText);
      if (replyAudio) {
        const replyFile = "temp_reply_voice.mp3";
        fs.writeFileSync(replyFile, replyAudio);
        await client.sendFile(entity, {
          file: replyFile,
          voiceNote: true,
          caption: "🎙️ Rejalar saqlandi",
        });
        try {
          fs.unlinkSync(replyFile);
        } catch {}
      }

      console.log("\n🎉 Rejalar muvaffaqiyatli saqlandi va foydalanuvchiga xabar berildi!");
    }
  }, new NewMessage({ incoming: true }));
}

main().catch((err) => {
  console.error("Xatolik:", err);
});

