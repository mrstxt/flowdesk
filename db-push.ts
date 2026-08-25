/**
 * Drizzle-kit o'rniga to'g'ridan-to'g'ri DB ga schema apply qilish.
 * Bu skript hamma jadvallarni yaratadi (agar yo'q bo'lsa).
 *
 * Ishlatish:
 *   DATABASE_URL="postgresql://..." npm run db:init
 * yoki
 *   .env faylidan DATABASE_URL ni avtomatik o'qiydi
 */

import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL o'rnatilmagan");
  process.exit(1);
}

const SQL = `
-- 1. settings
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT
);

-- 2. routines (intizom)
CREATE TABLE IF NOT EXISTS routines (
  id SERIAL PRIMARY KEY,
  time VARCHAR(5) NOT NULL,
  title VARCHAR(255) NOT NULL,
  last_done_date DATE,
  streak INTEGER DEFAULT 0,
  target_date DATE,
  start_time VARCHAR(5),
  end_time VARCHAR(5),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. tasks (kunlik ishlar)
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  category VARCHAR(50) DEFAULT 'personal',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. cards (kartalar — yangi)
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  bank VARCHAR(100),
  last4 VARCHAR(4),
  color VARCHAR(20) DEFAULT '#0a84ff',
  type VARCHAR(20) NOT NULL DEFAULT 'additional',
  balance NUMERIC(14, 2) NOT NULL DEFAULT '0',
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 5. card_transactions (karta audit log — yangi)
CREATE TABLE IF NOT EXISTS card_transactions (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(30) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  related_card_id INTEGER,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 6. orders (buyurtmalar)
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  stage VARCHAR(50) NOT NULL DEFAULT 'new',
  amount NUMERIC(12, 2) NOT NULL DEFAULT '0',
  deadline DATE,
  client_name VARCHAR(255),
  payment_type VARCHAR(50) DEFAULT 'cash',
  archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 7. incomes (yangi transactionId bilan)
CREATE TABLE IF NOT EXISTS incomes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  source VARCHAR(100) DEFAULT 'other',
  date DATE NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'cash',
  card_id INTEGER,
  transaction_id INTEGER,
  order_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 8. expenses (yangi transactionId bilan)
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  category VARCHAR(100) DEFAULT 'other',
  date DATE NOT NULL,
  card_id INTEGER,
  transaction_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 9. goals (maqsadlar — cardId bilan)
CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  saved_amount NUMERIC(12, 2) NOT NULL DEFAULT '0',
  auto_percent INTEGER DEFAULT 0,
  period VARCHAR(20) NOT NULL DEFAULT 'one_time',
  deadline DATE,
  period_started_at DATE,
  card_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

ALTER TABLE goals ADD COLUMN IF NOT EXISTS period VARCHAR(20) NOT NULL DEFAULT 'one_time';
ALTER TABLE goals ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS period_started_at DATE;

-- 10. sleep_logs
CREATE TABLE IF NOT EXISTS sleep_logs (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  expected_wake VARCHAR(5),
  actual_wake VARCHAR(5),
  expected_sleep VARCHAR(5),
  actual_sleep VARCHAR(5),
  overslept BOOLEAN DEFAULT FALSE,
  went_late_sleep BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 11. daily_results (kunlik natijalar)
CREATE TABLE IF NOT EXISTS daily_results (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  tasks_done BOOLEAN DEFAULT FALSE,
  finance_recorded BOOLEAN DEFAULT FALSE,
  response_type VARCHAR(20),
  response_text TEXT,
  video_file_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 12. bot_reminders
CREATE TABLE IF NOT EXISTS bot_reminders (
  id SERIAL PRIMARY KEY,
  routine_id INTEGER,
  date DATE NOT NULL,
  type VARCHAR(50) NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  responded BOOLEAN DEFAULT FALSE,
  response_text TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 12b. bot_states (wizard holati — serverless uchun)
CREATE TABLE IF NOT EXISTS bot_states (
  chat_id INTEGER PRIMARY KEY,
  mode VARCHAR(50) NOT NULL,
  step INTEGER DEFAULT 1,
  data TEXT,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 13. books
CREATE TABLE IF NOT EXISTS books (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255),
  total_pages INTEGER NOT NULL DEFAULT 0,
  current_page INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'plan',
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 14. videos
CREATE TABLE IF NOT EXISTS videos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  video_id VARCHAR(32) NOT NULL,
  category VARCHAR(50) DEFAULT 'other',
  watched BOOLEAN DEFAULT FALSE,
  watched_seconds INTEGER DEFAULT 0,
  last_watched_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 15. book_notes
CREATE TABLE IF NOT EXISTS book_notes (
  id SERIAL PRIMARY KEY,
  book_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  page INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 16. video_notes
CREATE TABLE IF NOT EXISTS video_notes (
  id SERIAL PRIMARY KEY,
  video_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
`;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log("🔌 Database ga ulanilmoqda...");
  await client.connect();
  console.log("✅ Ulandi");

  console.log("📋 Jadvallar yaratilmoqda...");
  await client.query(SQL);
  console.log("✅ Barcha jadvallar tayyor");

  // Mavjud jadvallarni ko'rsatamiz
  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log("\n📊 Mavjud jadvallar:");
  for (const row of tables.rows) {
    console.log(`  - ${row.table_name}`);
  }

  await client.end();
  console.log("\n🎉 Tayyor!");
}

main().catch((e) => {
  console.error("❌ Xatolik:", e.message);
  process.exit(1);
});
