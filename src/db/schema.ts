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
  orderId: integer("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }).default("other"),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  savedAmount: numeric("saved_amount", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  autoPercent: integer("auto_percent").default(0),
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

export const sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  expectedWake: varchar("expected_wake", { length: 5 }),
  actualWake: varchar("actual_wake", { length: 5 }),
  overslept: boolean("overslept").default(false),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
