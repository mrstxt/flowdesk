/**
 * FlowDesk Avtomatik Qo'ng'iroq va Ovozli Eslatma (Voice / TTS) Servisi
 *
 * 1. Microsoft Edge TTS (uz-UZ-MadinaNeural) orqali mutlaqo bepul tabiiy o'zbekcha audio hosil qiladi.
 * 2. Telegram Bot orqali foydalanuvchiga ovozli xabar (Voice note) yuboradi.
 * 3. Ikkinchi profil (Userbot) orqali to'g'ridan-to'g'ri Telegram Call (qo'ng'iroq) chaqiradi.
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import * as crypto from "crypto";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

/**
 * Matnni o'zbek tilidagi audio (MP3) faylga aylantiradi (100% bepul Microsoft Edge TTS)
 */
export async function generateUzbekSpeechAudio(text: string): Promise<Buffer | null> {
  try {
    const cleanText = text
      .replace(/<[^>]+>/g, "")
      .replace(/[\n\r]+/g, ". ")
      .slice(0, 300);

    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      "uz-UZ-MadinaNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );

    const ttsPromise = new Promise<Buffer | null>((resolve) => {
      try {
        const { audioStream } = tts.toStream(cleanText);
        const chunks: Buffer[] = [];
        audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        audioStream.on("end", () => {
          try { tts.close(); } catch {}
          resolve(Buffer.concat(chunks));
        });
        audioStream.on("error", (err) => {
          console.error("TTS stream error:", err);
          try { tts.close(); } catch {}
          resolve(null);
        });
      } catch (e) {
        console.error("toStream error:", e);
        try { tts.close(); } catch {}
        resolve(null);
      }
    });

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => {
        try { tts.close(); } catch {}
        resolve(null);
      }, 5000);
    });

    return await Promise.race([ttsPromise, timeoutPromise]);
  } catch (error) {
    console.error("generateUzbekSpeechAudio xatolik:", error);
    return null;
  }
}

/**
 * Telegram bot orqali foydalanuvchiga ovozli xabar (Voice note) yuborish
 */
export async function sendVoiceAlert(chatId: number, text: string): Promise<boolean> {
  // Foydalanuvchi talabi: Ovozli xabar (golos) yuborilmaydi, faqat matn yoziladi.
  return true;
}

function modPow(b: bigint, e: bigint, m: bigint): bigint {
  let res = BigInt(1);
  const zero = BigInt(0);
  const one = BigInt(1);
  const two = BigInt(2);
  b = b % m;
  while (e > zero) {
    if (e % two === one) res = (res * b) % m;
    e = e / two;
    b = (b * b) % m;
  }
  return res;
}

/**
 * Ikkinchi profil (Userbot) orqali Telegram Call (Qo'ng'iroq) chaqirish
 */
export async function triggerTelegramCall(
  targetUserIdOrUsername?: string | number,
  reason?: string
): Promise<{ called: boolean; message: string }> {
  const target =
    targetUserIdOrUsername ||
    process.env.TELEGRAM_TARGET_USER ||
    process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!target) {
    return { called: false, message: "Target user ko'rsatilmagan" };
  }

  const apiIdStr = process.env.TELEGRAM_CALLER_API_ID;
  const apiHash = process.env.TELEGRAM_CALLER_API_HASH;
  const sessionStr = process.env.TELEGRAM_CALLER_SESSION;

  if (!apiIdStr || !apiHash || !sessionStr) {
    return {
      called: false,
      message: "Userbot sozlanmagan (.env.local da ma'lumotlar yo'q)",
    };
  }

  const apiId = parseInt(apiIdStr, 10);
  const client = new TelegramClient(new StringSession(sessionStr), apiId, apiHash, {
    connectionRetries: 3,
  });

  try {
    await client.connect();

    // Diffie-Hellman parametrlarini olish
    const dh = (await client.invoke(
      new Api.messages.GetDhConfig({ version: 0, randomLength: 256 })
    )) as Api.messages.DhConfig;

    const p = BigInt("0x" + Buffer.from(dh.p).toString("hex"));
    const g = BigInt(dh.g);
    const aBytes = crypto.randomBytes(256);
    const a = BigInt("0x" + aBytes.toString("hex"));
    const g_a = modPow(g, a, p);

    let gAHex = g_a.toString(16);
    if (gAHex.length % 2 !== 0) gAHex = "0" + gAHex;
    const gABuffer = Buffer.from(gAHex, "hex");
    const gAHash = crypto.createHash("sha256").update(gABuffer).digest();

    const entity = await client.getInputEntity(target);

    await client.invoke(
      new Api.phone.RequestCall({
        userId: entity,
        randomId: Math.floor(Math.random() * 10000000),
        gAHash: gAHash,
        protocol: new Api.PhoneCallProtocol({
          minLayer: 93,
          maxLayer: 93,
          udpP2p: true,
          udpReflector: true,
          libraryVersions: ["1.16.0"],
        }),
      })
    );

    console.log(`[CALLER] Qo'ng'iroq muvaffaqiyatli chaqirildi (${target}): ${reason || ""}`);
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
