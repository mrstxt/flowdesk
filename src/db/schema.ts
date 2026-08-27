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
  author: varchar("author", { length: 255 }),
  totalPages: integer("total_pages").notNull().default(0),
  currentPage: integer("current_page").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("plan"),
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
  videoId: varchar("video_id", { length: 32 }).notNull(),
  category: varchar("category", { length: 50 }).default("other"),
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

/* ── Ish joylari / rollar va kunlik hisobotlar ── */

export const workRoles = pgTable("work_roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  tasksText: text("tasks_text"),
  monthlySalary: numeric("monthly_salary", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  dailySalary: numeric("daily_salary", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  reportQuestions: text("report_questions"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workReports = pgTable("work_reports", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull(),
  date: date("date").notNull(),
  answers: text("answers").notNull(),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
