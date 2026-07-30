# FlowDesk — Shaxsiy Admin Panel + Intizom Bot

Notion uslubidagi minimalistik panel. Aktsent `#ff2d5d`, Apple-style radiuslar, dark mode.

## Bo'limlar

| Bo'lim | Imkoniyat |
|---|---|
| **Dashboard** | Umumiy ko'rinish: KPI, intizom, vazifalar, maqsadlar, kitob |
| **Buyurtmalar** | Drag-and-drop Kanban (Yangi → Tasdiqlandi) |
| **Hisob-kitob** | Daromad/chiqim, 6 oylik grafik |
| **Maqsadlar** | Jamg'arma + avtomatik foiz |
| **Intizom** | Uyg'onish/uxlash, kunlik reja timeline, streak 🔥, **Telegram bot yoqish/o'chirish** |
| **Kitoblar** | O'qish progressi, sahifa kuzatuvi, sharhlar |
| **Videolar** | YouTube panelda, ko'rildi belgisi, fikrlar |
| **Analitika** | Oylik taqoshlash, o'sish %, tavsiyalar |

## Telegram Bot — Intizom nazoratchi

Bot sizning intizomingizni boshqaradi va xavflantiradi:

### Qanday ishlaydi

1. **Ertalab** (`wake_time` da) — ☀️ "Turing!" xabari → ✅ Turdim / 😴 Uxlab qoldim
2. **Uxlab qolsangiz** — sabab so'raydi → saqlaydi
3. **Har reja vaqtida** — ⏰ eslatma → ✅ Bajarildi / ⏭ O'tkazish
4. **Kechqurun 20:00** — 📋 kunlik hisobot
5. **Yotish vaqtida** — 🌙 eslatma

### Vercelga joylash

1. **GitHub → Vercel:**
   ```bash
   git init && git add -A && git commit -m "FlowDesk"
   git remote add origin https://github.com/SIZ/flowdesk.git
   git push -u origin main
   ```
   https://vercel.com/new → import qiling.

2. **Environment Variables:**
   | Kalit | Qiymat |
   |---|---|
   | `DATABASE_URL` | Vercel Postgres / Neon URL |
   | `SESSION_SECRET` | login sessiyasi uchun uzun, tasodifiy maxfiy satr |
   | `ADMIN_USERNAME` | panelga kirish login |
   | `ADMIN_PASSWORD` | panelga kirish parol |
   | `TELEGRAM_BOT_TOKEN` | @BotFather token |
   | `TELEGRAM_ADMIN_CHAT_ID` | chat ID (@userinfobot) |
   | `BOT_WEBHOOK_SECRET` | tasodifiy satr |
   | `VERCEL_CRON_SECRET` | tasodifiy satr |

3. **Jadvallar:**
   ```bash
   DATABASE_URL="postgresql://..." npx drizzle-kit push
   ```

4. **Bot webhook:**
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SIZNING_DOMEN/api/bot&secret_token=<BOT_WEBHOOK_SECRET>
   ```

5. **Vercel Cron** (Project → Settings → Cron Jobs):
   - URL: `/api/cron/discipline`
   - Schedule: `*/30 * * * *` (har 30 daqiqa)

### Bot buyruqlari

| Buyruq | Format |
|---|---|
| Buyurtma | `/buyurtma Logo, 500000, 2026-03-01, Ali` |
| Chiqim | `/chiqim Ijara, 2000000, ijara` |
| Kirim | `/kirim Bonus, 800000, karta` |
| Vazifa | `/vazifa Qo'ng'iroq, 2026-02-27, shoshilinch` |
| Maqsad | `/maqsad Noutbuk, 12000000, 10` |
| Kitob | `/kitob Atomic Habits, James Clear, 320` |
| Video | `/video https://youtu.be/xxx, Nomi, biznes` |
| To'lov | `/tolov 12` |
| Rejalar | `/rejalarni` — bugungi reja ro'yxati |
| Statistika | `/stat`, `/bugun`, `/buyurtmalar` |
| Bot yoqish | `/bot_yoq` — ogohlantirishlarni yoqish |
| Bot o'chirish | `/bot_och` — ogohlantirishlarni o'chirish |

Yoki **Intizom** bo'limidagi toggle tugmasini bosing — bot avtomatik yoqiladi.
