import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  numeric,
  date,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

/* ── Kartalar (pul tushadigan karta) ── */

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  // Ixtiyoriy: bank, karta raqami oxirgi 4 ta raqami
  bank: varchar("bank", { length: 100 }),
  last4: varchar("last4", { length: 4 }),
  color: varchar("color", { length: 20 }).default("#0a84ff"),
  // "primary" = asosiy karta (1 ta bo'ladi), "additional" = qo'shimcha
  type: varchar("type", { length: 20 }).notNull().default("additional"),
  // Hozirgi qoldiq (so'm) — real-time yangilanadi
  balance: numeric("balance", { precision: 14, scale: 2 })
    .notNull()
    .default("0"),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Karta harakatlari (audit log) ── */

export const cardTransactions = pgTable("card_transactions", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull(),
  date: date("date").notNull(),
  // "in" = kirim, "out" = chiqim, "transfer_in" = boshqa kartadan tushdi,
  // "transfer_out" = boshqa kartaga o'tdi, "goal_in" = maqsadga ajratildi
  type: varchar("type", { length: 30 }).notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  // Transfer uchun — qaysi kartaga/papkan o'tgani
  relatedCardId: integer("related_card_id"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  stage: varchar("stage", { length: 50 }).notNull().default("new"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  deadline: date("deadline"),
  clientName: varchar("client_name", { length: 255 }),
  paymentType: varchar("payment_type", { length: 50 }).default("cash"),
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  date: date("date").notNull(),
  completed: boolean("completed").default(false),
  category: varchar("category", { length: 50 }).default("personal"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const incomes = pgTable("incomes", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  source: varchar("source", { length: 100 }).default("other"),
  date: date("date").notNull(),
  paymentType: varchar("payment_type", { length: 50 }).default("cash"),
  // Qaysi kartaga tushgan (nullable — naqd pul uchun)
  cardId: integer("card_id"),
  // card_transactions bilan bog'lash
  transactionId: integer("transaction_id"),
  orderId: integer("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }).default("other"),
  date: date("date").notNull(),
  // Qaysi kartadan chiqqan (nullable)
  cardId: integer("card_id"),
  transactionId: integer("transaction_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  savedAmount: numeric("saved_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  usedAmount: numeric("used_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  lastUsedAt: timestamp("last_used_at"),
  autoPercent: integer("auto_percent").default(0),
  period: varchar("period", { length: 20 }).notNull().default("one_time"),
  deadline: date("deadline"),
  periodStartedAt: date("period_started_at"),
  // Qaysi kartaga to'planadi (nullable — umumiy)
  cardId: integer("card_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  dueDay: integer("due_day").notNull().default(1),
  cycle: varchar("cycle", { length: 20 }).notNull().default("monthly"),
  category: varchar("category", { length: 100 }).default("subscriptions"),
  active: boolean("active").default(true),
  lastPaidAt: date("last_paid_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Kunlik intizom ── */

export const settings = pgTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
});

export const routines = pgTable("routines", {
  id: serial("id").primaryKey(),
  time: varchar("time", { length: 5 }).notNull(),
  // Reja uchun belgilangan sana (masalan ertangi kun). NULL = har kuni
  targetDate: date("target_date"),
  // Reja boshlanish vaqti (default = time bilan bir xil)
  startTime: varchar("start_time", { length: 5 }),
  // Reja tugash vaqti / deadline (ixtiyoriy)
  endTime: varchar("end_time", { length: 5 }),
  title: varchar("title", { length: 255 }).notNull(),
  lastDoneDate: date("last_done_date"),
  streak: integer("streak").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Kitoblar ── */

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  author: varchar("author", { length: 255 }).default("AI Podkast Xulosasi"),
  totalPages: integer("total_pages").notNull().default(0),
  currentPage: integer("current_page").notNull().default(0),
  status: varchar("status", { length: 50 }).notNull().default("rejalashtirilgan"),
  summary: text("summary"),
  // Ixtiyoriy PDF varianti havolasi
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookNotes = pgTable("book_notes", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  content: text("content").notNull(),
  page: integer("page"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Rivojlanish videolari ── */

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  url: text("url").notNull(),
  videoId: varchar("video_id", { length: 64 }).default(""),
  category: varchar("category", { length: 50 }).default("rivojlanish"),
  summary: text("summary"),
  watched: boolean("watched").default(false),
  // Pauza qilganda eslab qolish uchun (sekundlarda)
  watchedSeconds: integer("watched_seconds").default(0),
  lastWatchedAt: timestamp("last_watched_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const videoNotes = pgTable("video_notes", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Bot intizom tizimi ── */

export const botReminders = pgTable("bot_reminders", {
  id: serial("id").primaryKey(),
  routineId: integer("routine_id"),
  date: date("date").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // wake_up, routine, sleep
  sent: boolean("sent").default(false),
  responded: boolean("responded").default(false),
  responseText: text("response_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Bot foydalanuvchi holati (wizard) — serverless uchun DB da saqlanadi ── */

export const botStates = pgTable("bot_states", {
  chatId: integer("chat_id").primaryKey(),
  // mode: order, expense, income, book, video, goal, wake_reason, tomorrow_task, ...
  mode: varchar("mode", { length: 50 }).notNull(),
  step: integer("step").notNull().default(1),
  // data JSON string ko'rinishida saqlanadi
  data: text("data"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  expectedWake: varchar("expected_wake", { length: 5 }),
  actualWake: varchar("actual_wake", { length: 5 }),
  expectedSleep: varchar("expected_sleep", { length: 5 }),
  actualSleep: varchar("actual_sleep", { length: 5 }),
  overslept: boolean("overslept").default(false),
  wentLateSleep: boolean("went_late_sleep").default(false),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Kunlik natijalar (kechqurun bot tekshiruvi uchun) ── */

export const dailyResults = pgTable("daily_results", {
  id: serial("id").primaryKey(),
  date: date("date").notNull().unique(),
  // Kechqurun savol: ishlarni bajardingizmi? (ha/yoq)
  tasksDone: boolean("tasks_done").default(false),
  // Kechqurun savol: hisob yozdingizmi? (ha/yoq)
  financeRecorded: boolean("finance_recorded").default(false),
  // "Yoq" bo'lsa: video yoki matn yuborgan javob
  responseType: varchar("response_type", { length: 20 }), // "video" | "text" | null
  responseText: text("response_text"),
  // Telegram file_id agar video yuborgan bo'lsa
  videoFileId: varchar("video_file_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Media: Ijtimoiy tarmoq profillari ── */

export const socialProfiles = pgTable("social_profiles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull().default("instagram"), // instagram, telegram, youtube, tiktok, behance, facebook, other
  handle: varchar("handle", { length: 255 }), // @sovo_branding
  url: text("url"),
  avatarUrl: text("avatar_url"),
  followersCount: integer("followers_count").default(0),
  category: varchar("category", { length: 100 }).default("Dizayn"),
  description: text("description"),
  status: varchar("status", { length: 50 }).default("active"), // active, growing, paused
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Media: Kontent rejasi va postlar ── */

export const contentItems = pgTable("content_items", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id"),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("post"), // post, reels, carousel, story, article, portfolio
  stage: varchar("stage", { length: 50 }).notNull().default("idea"), // idea, draft, in_progress, ready, published
  caption: text("caption"),
  hook: text("hook"),
  body: text("body"),
  cta: text("cta"),
  frames: text("frames"), // JSON array of frame URLs: e.g. '["url1", "url2", "url3", "url4"]'
  notified: boolean("notified").default(false),
  mediaUrls: text("media_urls"),
  scheduledDate: date("scheduled_date"),
  scheduledTime: varchar("scheduled_time", { length: 5 }),
  publishedAt: timestamp("published_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── Media: Profil resurslari (feys rasmlari, oylik kontentlar, grid preview) ── */

export const profileAssets = pgTable("profile_assets", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull().default("face"), // 'face' | 'monthly' | 'grid' | 'highlight'
  month: varchar("month", { length: 20 }), // e.g. '2026-10'
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 50 }).default("image"), // image, video, file
  caption: text("caption"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Yuklangan fayllar (PostgreSQL da doimiy saqlash — ephemeral diskdan himoya) ── */

export const uploadedFiles = pgTable("uploaded_files", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }).notNull().unique(),
  mimeType: varchar("mime_type", { length: 100 }).notNull().default("image/jpeg"),
  data: text("data").notNull(), // Base64 kodlangan rasm ma'lumoti
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── Media: AI Modellar va vositalar ── */

export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  category: varchar("category", { length: 100 }).notNull().default("image"), // image, video, text, voice, face_swap, 3d, other
  description: text("description"),
  promptTemplate: text("prompt_template"), // sevimli prompt yoki ko'rsatmalar
  notes: text("notes"),
  favorite: boolean("favorite").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── O'qish: Universitetlar tahlili ── */

export const universities = pgTable("universities", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }).notNull().default("O'zbekiston"),
  city: varchar("city", { length: 100 }),
  major: varchar("major", { length: 255 }).notNull(), // Ta'lim yo'nalishi / Mutaxassislik
  degree: varchar("degree", { length: 50 }).default("Bakalavr"), // Bakalavr, Magistratura, PhD, Kurs
  tuitionFee: varchar("tuition_fee", { length: 100 }), // Masalan: "12,000,000 so'm / yil" yoki "$15,000 / year"
  hasGrant: boolean("has_grant").default(false), // Davlat granti yoki stipendiya bormi
  grantDetails: text("grant_details"), // Grant shartlari
  requirements: text("requirements"), // IELTS 6.5, SAT 1200+, DTMI 140+ va h.k.
  deadline: date("deadline"), // Hujjat topshirish oxirgi muddati
  admissionStatus: varchar("admission_status", { length: 50 }).notNull().default("rejalashtirilgan"), // rejalashtirilgan, hujjat_topshirildi, qabul_qilindi, rad_etildi
  ranking: varchar("ranking", { length: 50 }), // QS reyting yoki O'zbekiston reytingi
  websiteUrl: text("website_url"),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── O'qish: O'rganish rejalari (Roadmap & Ko'nikmalar) ── */

export const studyRoadmaps = pgTable("study_roadmaps", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }).notNull().default("Dasturlash"), // Dasturlash, AI / ML, Til o'rganish, Biznes, Matematika, Boshqa
  priority: varchar("priority", { length: 20 }).default("high"), // high, medium, low
  status: varchar("status", { length: 50 }).notNull().default("in_progress"), // rejalashtirilgan, in_progress, completed
  progress: integer("progress").default(0), // 0 to 100 foiz
  targetDate: date("target_date"),
  resources: text("resources"), // Kurslar, kitoblar, linklar
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ── O'qish: Kunlik 5 ta AI Yangilik ── */

export const aiDailyNews = pgTable("ai_daily_news", {
  id: serial("id").primaryKey(),
  newsDate: date("news_date").notNull(), // Sana bo'yicha guruhlash (masalan 2026-10-15)
  title: varchar("title", { length: 300 }).notNull(),
  summary: text("summary").notNull(),
  keyTakeaway: text("key_takeaway"),
  sourceUrl: text("source_url"),
  sourceName: varchar("source_name", { length: 100 }),
  category: varchar("category", { length: 50 }).default("AI & Tech"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* ── AI Kotib (Madina) Chat Tarixi ── */

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  actionTaken: varchar("action_taken", { length: 255 }),
  pdfUrl: text("pdf_url"),
  source: varchar("source", { length: 50 }).default("web_panel"), // "web_panel" | "telegram"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});





