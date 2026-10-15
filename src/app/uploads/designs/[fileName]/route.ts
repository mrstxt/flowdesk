import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\\\")) {
      return new Response("Not found", { status: 404 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "designs");
    const filePath = path.resolve(uploadsDir, path.basename(fileName));
    // Path traversal hisobga olinmasligi uchun qat'iy tekshiruv
    if (!filePath.startsWith(path.resolve(uploadsDir) + path.sep)) {
      return new Response("Not found", { status: 404 });
    }

    const ext = path.extname(fileName).toLowerCase();
    const defaultMime =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
        ? "image/webp"
        : ext === ".gif"
        ? "image/gif"
        : ext === ".svg"
        ? "image/svg+xml"
        : "image/jpeg";

    // 1. Agar lokal diskda mavjud bo'lsa — to'g'ridan-to'g'ri o'qib beramiz
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath);
      return new Response(buffer, {
        headers: {
          "Content-Type": defaultMime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. Agar diskda bo'lmasa (masalan, deploy/restartdan keyin) — PostgreSQL dan olamiz
    const [row] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.fileName, fileName))
      .limit(1);

    if (row && row.data) {
      const buffer = Buffer.from(row.data, "base64");

      // Disk keshiga ham yozib qo'yamiz (keyingi so'rovlar yanada tez bo'lishi uchun)
      try {
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }
        await writeFile(filePath, buffer);
      } catch (wErr) {
        // Diskka yozolmasa ham DB dan beramiz
      }

      return new Response(buffer, {
        headers: {
          "Content-Type": row.mimeType || defaultMime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response("Rasm topilmadi", { status: 404 });
  } catch (err: any) {
    console.error("GET /uploads/designs/[fileName] xatosi:", err);
    return new Response("Server xatosi", { status: 500 });
  }
}

