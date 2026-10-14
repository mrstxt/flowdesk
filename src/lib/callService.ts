/**
 * FlowDesk Avtomatik Qo'ng'iroq va Ovozli Eslatma (Voice / TTS) Servisi
 *
 * 1. Google TTS orqali mutlaqo bepul o'zbekcha audio hosil qiladi.
 * 2. Telegram Bot orqali foydalanuvchiga ovozli xabar (Voice note) yuboradi.
 * 3. Ikkinchi profil (Userbot) orqali Telegram Call (qo'ng'iroq) chaqiradi.
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

/**
 * Matnni o'zbek tilidagi audio (MP3) faylga aylantiradi (100% bepul Google TTS)
 */
export async function generateUzbekSpeechAudio(text: string): Promise<ArrayBuffer | null> {
  try {
    const cleanText = text
      .replace(/<[^>]+>/g, "")
      .replace(/[\n\r]+/g, ". ")
      .slice(0, 200);

    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      cleanText
    )}&tl=uz&client=tw-ob`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
    });

    if (!res.ok) {
      console.error("TTS yuklashda xatolik:", res.status);
      return null;
    }

    return await res.arrayBuffer();
  } catch (error) {
    console.error("generateUzbekSpeechAudio xatolik:", error);
    return null;
  }
}

/**
 * Telegram bot orqali foydalanuvchiga ovozli xabar (Voice note) yuborish
 */
export async function sendVoiceAlert(chatId: number, text: string): Promise<boolean> {
  if (!TOKEN) return false;

  try {
    const audioBuffer = await generateUzbekSpeechAudio(text);
    if (!audioBuffer) return false;

    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    formData.append(
      "voice",
      new Blob([audioBuffer], { type: "audio/ogg" }),
      "voice_alert.ogg"
    );
    formData.append(
      "caption",
      "🎙️ <b>Ovozli eslatma:</b>\n" + text.slice(0, 150)
    );
    formData.append("parse_mode", "HTML");

    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendVoice`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("sendVoiceAlert xatolik:", err);
      return false;
    }

    return true;
  } catch (e) {
    console.error("sendVoiceAlert error:", e);
    return false;
  }
}

/**
 * Ikkinchi profil (Userbot) orqali Telegram Call (Qo'ng'iroq) chaqirish
 */
export async function triggerTelegramCall(
  targetUserIdOrUsername: string | number,
  reason: string
): Promise<{ called: boolean; message: string }> {
  const apiIdStr = process.env.TELEGRAM_CALLER_API_ID;
  const apiHash = process.env.TELEGRAM_CALLER_API_HASH;
  const sessionStr = process.env.TELEGRAM_CALLER_SESSION;

  if (!apiIdStr || !apiHash || !sessionStr) {
    return {
      called: false,
      message:
        "Userbot sozlanmagan (API_ID, API_HASH yoki SESSION yo'q). npx tsx caller-login.ts orqali ulaning.",
    };
  }

  const apiId = parseInt(apiIdStr, 10);
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();
    const entity = await client.getInputEntity(targetUserIdOrUsername);

    // Telegram MTProto orqali qo'ng'iroq chaqirish (Ringing)
    const gA = Buffer.from("flowdesk-call-" + Date.now()).slice(0, 32);
    await client.invoke(
      new Api.phone.RequestCall({
        userId: entity,
        randomId: Math.floor(Math.random() * 10000000),
        gAHash: gA,
        protocol: new Api.PhoneCallProtocol({
          minLayer: 93,
          maxLayer: 93,
          udpP2p: true,
          udpReflector: true,
          libraryVersions: ["1.16.0"],
        }),
      })
    );

    console.log(`[CALLER] Muvaffaqiyatli qo'ng'iroq chaqirildi: ${reason}`);
    await client.disconnect();
    return { called: true, message: "Telegram orqali qo'ng'iroq qilindi!" };
  } catch (error) {
    console.error("triggerTelegramCall xatolik:", error);
    try {
      await client.disconnect();
    } catch {}
    return {
      called: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
