import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { uploadedFiles } from "@/db/schema";

/**
 * YouTube yoki Podkast matnli xulosasidan chiroyli PDF kitobcha yaratadi
 * va uni public/uploads/books/ papkasiga saqlaydi.
 * 
 * @param title Kitob / podkast nomi
 * @param content Batafsil xulosa va konspekt matni
 * @returns Statik URL manzili (masalan: /uploads/books/summary_1234.pdf)
 */
export async function createSummaryPdf(
  title: string,
  content: string
): Promise<string> {
  const booksDir = path.join(process.cwd(), "public", "uploads", "books");
  if (!fs.existsSync(booksDir)) {
    fs.mkdirSync(booksDir, { recursive: true });
  }

  const cleanSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 30);
  const fileName = `book_${Date.now()}_${cleanSlug || "summary"}.pdf`;
  const filePath = path.join(booksDir, fileName);

  return new Promise<string>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: title,
          Author: "FlowDesk AI Podkast Xulosasi",
          Creator: "FlowDesk AI Agent",
        },
      });

      const writeStream = fs.createWriteStream(filePath);
      const buffers: Buffer[] = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.pipe(writeStream);

      // ─── Header: Brand Badge ───
      doc
        .fontSize(10)
        .fillColor("#6366f1")
        .text("FLOWDESK AI  •  PODKAST VA KITOBLAR XULOSASI", {
          align: "center",
          characterSpacing: 1.5,
        });

      doc.moveDown(0.5);

      // Chiziq
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(1.5);

      // ─── Title ───
      doc
        .fontSize(20)
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .text(title, { align: "left" });

      doc.moveDown(0.5);

      // Meta: Sana & Muallif
      const todayStr = new Date().toLocaleDateString("uz-UZ", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      doc
        .fontSize(10)
        .fillColor("#64748b")
        .font("Helvetica")
        .text(`Sana: ${todayStr}   |   Muallif: AI Podkast Xulosasi`, {
          align: "left",
        });

      doc.moveDown(1);

      // Separator
      doc
        .strokeColor("#f1f5f9")
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(1.5);

      // ─── Content Body ───
      doc.fontSize(11).fillColor("#334155").font("Helvetica");

      // Paragraf bo'yicha chiroyli joylashtiramiz
      const paragraphs = content.split("\n");
      for (const p of paragraphs) {
        const trimmed = p.trim();
        if (!trimmed) {
          doc.moveDown(0.6);
          continue;
        }

        // Kichik sarlavhalar (masalan # yoki **)
        if (trimmed.startsWith("#") || trimmed.startsWith("📌") || trimmed.startsWith("💡")) {
          doc.moveDown(0.5);
          doc
            .fontSize(13)
            .fillColor("#1e293b")
            .font("Helvetica-Bold")
            .text(trimmed.replace(/^#+\s*/, ""));
          doc.fontSize(11).fillColor("#334155").font("Helvetica");
          doc.moveDown(0.3);
        } else if (trimmed.startsWith("-") || trimmed.startsWith("•") || trimmed.startsWith("*")) {
          // Bullet point
          doc.text(`   •  ${trimmed.replace(/^[-•*]\s*/, "")}`, {
            lineGap: 3,
          });
        } else {
          doc.text(trimmed, {
            lineGap: 4,
            align: "justify",
          });
        }
      }

      // ─── Footer: Brand signature ───
      doc.moveDown(2);
      doc
        .strokeColor("#e2e8f0")
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();

      doc.moveDown(0.8);
      doc
        .fontSize(9)
        .fillColor("#94a3b8")
        .text(
          "Ushbu xulosa FlowDesk shaxsiy AI assistenti tomonidan YouTube video asosida tayyorlandi.",
          { align: "center" }
        );

      doc.end();

      writeStream.on("finish", async () => {
        const webUrl = `/uploads/books/${fileName}`;

        // Doimiy saqlash (PostgreSQL uploaded_files jadvali)
        try {
          const finalBuffer = Buffer.concat(buffers);
          await db
            .insert(uploadedFiles)
            .values({
              fileName,
              mimeType: "application/pdf",
              data: finalBuffer.toString("base64"),
            })
            .onConflictDoNothing();
        } catch (dbErr) {
          console.warn("PDF DB ga saqlashda ogohlantirish:", dbErr);
        }

        resolve(webUrl);
      });

      writeStream.on("error", (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

