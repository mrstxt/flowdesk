import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Fayl topilmadi" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Data = buffer.toString("base64");

    const ext = path.extname(file.name).toLowerCase() || ".jpg";
    const mimeType =
      file.type ||
      (ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
        ? "image/gif"
        : "image/jpeg");

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
      { error: err.message || "Faylni saqlashda xatolik" },
      { status: 500 }
    );
  }
}
