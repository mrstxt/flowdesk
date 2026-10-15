import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/** Ruxsat etilgan fayl kengaytmalari */
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
/** Maksimal fayl hajmi: 10 MB */
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const limit = rateLimit(`upload:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Fayl topilmadi" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Fayl hajmi 10 MB dan oshmasligi kerak." },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");

    // Xavfli kengaytmalar rad etiladi; nom doim random bo'ladi (path traversal cheklanadi)
    const rawExt = path.extname(file.name).toLowerCase();
    const ext = ALLOWED_EXT.has(rawExt) ? rawExt : ".jpg";
    const mimeType =
      file.type && file.type.startsWith("image/")
        ? file.type
        : ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".svg"
        ? "image/svg+xml"
        : "image/jpeg";

    const fileName = `design_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;

    // 1. PostgreSQL ga doimiy saqlaymiz (ephemeral disk restartlaridan to'liq himoya)
    try {
      await db.insert(uploadedFiles).values({
        fileName,
        mimeType,
        data: base64Data,
      });
    } catch (dbErr) {
      console.error("DB ga fayl saqlash xatoligi:", dbErr);
    }

    // 2. Lokal diskka ham tezkor kesh sifatida yozamiz
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "designs");
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true });
      }
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, buffer);
    } catch (diskErr) {
      console.warn("Lokal diskka yozish ogohlantirish:", diskErr);
    }

    return NextResponse.json({
      url: `/uploads/designs/${fileName}`,
      name: file.name,
      fileName,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}
