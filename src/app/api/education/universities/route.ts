import { NextResponse } from "next/server";
import { db } from "@/db";
import { universities } from "@/db/schema";
import { desc, eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_UNIVERSITIES = [
  {
    name: "Yangi O'zbekiston Universiteti (New Uzbekistan University)",
    country: "O'zbekiston",
    city: "Toshkent",
    major: "Software Engineering & Artificial Intelligence",
    degree: "Bakalavr",
    tuitionFee: "39,000,000 so'm / yil",
    hasGrant: true,
    grantDetails: "Davlat granti va to'liq 100% stipendiyali grantlar mavjud",
    requirements: "IELTS 6.5+, Matematika & Mantiq imtihoni",
    deadline: "2026-07-20",
    admissionStatus: "rejalashtirilgan",
    ranking: "#1 O'zbekistonda (Yangi OTM)",
    websiteUrl: "https://newuu.uz",
    notes: "TUM (Munich) va MIT dasturlari asosida o'qitiladi, AI laboratoriyalari kuchli.",
    sortOrder: 1,
  },
  {
    name: "INHA University in Tashkent (IUT)",
    country: "O'zbekiston",
    city: "Toshkent",
    major: "Computer Science and Software Engineering (SOCIE)",
    degree: "Bakalavr",
    tuitionFee: "32,500,000 so'm / yil",
    hasGrant: true,
    grantDetails: "Har semestr a'lochi talabalar uchun 100% va 50% grantlar",
    requirements: "IELTS 5.5+ (6.0 tavsiya etiladi), Matematika imtihoni",
    deadline: "2026-07-15",
    admissionStatus: "rejalashtirilgan",
    ranking: "Janubiy Koreya INHA filiali",
    websiteUrl: "https://inha.uz",
    notes: "Kuchli IT muhit, Janubiy Koreya diplomi, almashinuv dasturi (3+1).",
    sortOrder: 2,
  },
  {
    name: "Vestminster Xalqaro Universiteti (WIUT)",
    country: "O'zbekiston",
    city: "Toshkent",
    major: "Business Information Systems (BIS)",
    degree: "Bakalavr",
    tuitionFee: "35,000,000 so'm / yil",
    hasGrant: true,
    grantDetails: "30 ta eng yuqori ball to'plaganlarga 100% davlat granti",
    requirements: "IELTS 6.0+, Matematika (WIUT Math Exam)",
    deadline: "2026-06-30",
    admissionStatus: "rejalashtirilgan",
    ranking: "Buyuk Britaniya Westminster diplomi",
    websiteUrl: "https://wiut.uz",
    notes: "Biznes va IT uyg'unligi, ingliz tili muhiti, xalqaro akkreditatsiya.",
    sortOrder: 3,
  },
  {
    name: "Technical University of Munich (TUM)",
    country: "Germaniya",
    city: "Myunxen",
    major: "Informatics / Data Engineering and Analytics",
    degree: "Bakalavr / Magistr",
    tuitionFee: "€2,000 - €3,000 / semestr (bepul/arzon)",
    hasGrant: true,
    grantDetails: "DAAD stipensiyasi, Deutschlandstipendium",
    requirements: "IELTS 6.5+, Nemis tili (B2/C1) yoki ingliz tili, Studienkolleg / SAT",
    deadline: "2026-07-15",
    admissionStatus: "rejalashtirilgan",
    ranking: "QS #28 dunyo bo'yicha",
    websiteUrl: "https://www.tum.de",
    notes: "Yevropadagi #1 texnika universiteti, kuchli startap ekotizimi va AI markazi.",
    sortOrder: 4,
  },
];

export async function GET() {
  try {
    let all = await db
      .select()
      .from(universities)
      .orderBy(asc(universities.sortOrder), desc(universities.createdAt));

    if (all.length === 0) {
      for (const item of DEFAULT_UNIVERSITIES) {
        await db.insert(universities).values(item);
      }
      all = await db
        .select()
        .from(universities)
        .orderBy(asc(universities.sortOrder), desc(universities.createdAt));
    }

    return NextResponse.json({ success: true, data: all });
  } catch (error: any) {
    console.error("GET universities error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      country,
      city,
      major,
      degree,
      tuitionFee,
      hasGrant,
      grantDetails,
      requirements,
      deadline,
      admissionStatus,
      ranking,
      websiteUrl,
      notes,
    } = body;

    if (!name || !major) {
      return NextResponse.json(
        { success: false, error: "Nom va yo'nalish majburiy" },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(universities)
      .values({
        name,
        country: country || "O'zbekiston",
        city: city || null,
        major,
        degree: degree || "Bakalavr",
        tuitionFee: tuitionFee || null,
        hasGrant: !!hasGrant,
        grantDetails: grantDetails || null,
        requirements: requirements || null,
        deadline: deadline || null,
        admissionStatus: admissionStatus || "rejalashtirilgan",
        ranking: ranking || null,
        websiteUrl: websiteUrl || null,
        notes: notes || null,
      })
      .returning();

    return NextResponse.json({ success: true, data: created });
  } catch (error: any) {
    console.error("POST university error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID majburiy" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(universities)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(universities.id, Number(id)))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("PUT university error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID majburiy" },
        { status: 400 }
      );
    }

    await db.delete(universities).where(eq(universities.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE university error:", error);
    return NextResponse.json(
      { success: false, error: "Server xatosi (batafsil logda)" },
      { status: 500 }
    );
  }
}

