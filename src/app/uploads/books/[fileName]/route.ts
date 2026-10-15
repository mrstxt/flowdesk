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
    if (!fileName || fileName.includes("..") || fileName.includes("/")) {
      return new Response("Not found", { status: 404 });
    }

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "books");
    const filePath = path.resolve(uploadsDir, path.basename(fileName));
    // Path traversal hisobga olinmasligi uchun qat'iy tekshiruv
    if (!filePath.startsWith(path.resolve(uploadsDir) + path.sep)) {
      return new Response("Not found", { status: 404 });
    }

    // 1. Agar lokal diskda mavjud bo'lsa
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // 2. Agar diskda bo'lmasa (restartdan keyin) — PostgreSQL dan olamiz
    const [row] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.fileName, fileName))
      .limit(1);

    if (row && row.data) {
      const buffer = Buffer.from(row.data, "base64");

      try {
        if (!existsSync(uploadsDir)) {
          await mkdir(uploadsDir, { recursive: true });
        }
        await writeFile(filePath, buffer);
      } catch {}

      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new Response("PDF topilmadi", { status: 404 });
  } catch (error) {
    console.error("PDF serve error:", error);
    return new Response("Server xatosi", { status: 500 });
  }
}

