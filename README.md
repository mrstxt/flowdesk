# FlowDesk

FlowDesk — shaxsiy admin panel: buyurtmalar, moliya, maqsadlar, intizom, kitoblar, rivojlanish videolari va Telegram intizom bot.

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| Dashboard | KPI, bugungi vazifalar, intizom, maqsad va kitob progressi |
| Buyurtmalar | Kanban uslubida buyurtmalarni yuritish |
| Hisob-kitob | Kirim/chiqim va oylik grafiklar |
| Maqsadlar | Jamg'arma va avtomatik foiz hisoblash |
| Intizom | Uyg'onish/uxlash va kunlik reja nazorati |
| Kitoblar | O'qish progressi va qaydlar |
| Rivojlanish | YouTube video ro'yxati va fikrlar |
| Analitika | Oylik taqqoslash va tavsiyalar |
| Telegram bot | Buyurtma, kirim, chiqim, vazifa va intizom buyruqlari |

## Install paytidagi warning haqida

`npm warn deprecated @esbuild-kit/...` xato emas. Bu Drizzle/tsx ekotizimidagi eski dependency haqida ogohlantirish. Agar oxirida `added ... packages` chiqsa, install muvaffaqiyatli tugagan.

## Local Ishga Tushirish

1. Dependencylarni o'rnating:

```bash
npm install
```

2. `.env.example`dan nusxa olib `.env` yarating:

```bash
cp .env.example .env
```

3. `.env` ichidagi qiymatlarni to'ldiring. Eng kamida panel ishlashi uchun `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` kerak.

4. Database jadvallarini yarating:

```bash
npm run db:push
```

5. Development serverni yoqing:

```bash
npm run dev
```

Keyin brauzerda `http://localhost:3000` ochiladi.

## Env Variables

### Majburiy

| Kalit | Misol | Izoh |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` | Neon, Supabase, Vercel Postgres yoki local Postgres ulanish URL |
| `SESSION_SECRET` | `9b4f...uzun-random...` | Login cookie imzosini himoya qiladi. Productionda uzun random satr bo'lishi shart |
| `ADMIN_USERNAME` | `admin` | Panelga kirish login |
| `ADMIN_PASSWORD` | `kuchli-parol` | Panelga kirish parol |

### Telegram Bot Uchun

| Kalit | Misol | Izoh |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | @BotFather bergan bot token |
| `TELEGRAM_ADMIN_CHAT_ID` | `123456789` | Sizning Telegram chat ID. @userinfobot orqali olinadi |
| `BOT_WEBHOOK_SECRET` | `random-webhook-secret` | Telegram webhook so'rovlarini tekshirish uchun maxfiy satr |
| `VERCEL_CRON_SECRET` | `random-cron-secret` | Cron endpointni himoya qilish uchun maxfiy satr |

### Local Postgres Misol

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/app_db"
SESSION_SECRET="local-development-secret-change-me"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="admin123"

TELEGRAM_BOT_TOKEN=""
TELEGRAM_ADMIN_CHAT_ID=""
BOT_WEBHOOK_SECRET="local-webhook-secret"
VERCEL_CRON_SECRET="local-cron-secret"
```

### Production/Vercel Misol

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DATABASE?sslmode=require"
SESSION_SECRET="juda-uzun-random-secret-64-belgidan-kam-bolmasin"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="juda-kuchli-parol"

TELEGRAM_BOT_TOKEN="BOTFATHER_TOKEN"
TELEGRAM_ADMIN_CHAT_ID="SIZNING_CHAT_ID"
BOT_WEBHOOK_SECRET="juda-uzun-random-webhook-secret"
VERCEL_CRON_SECRET="juda-uzun-random-cron-secret"
```

## Vercelga Joylash

1. Repository GitHubga push qilingan bo'lishi kerak:

```bash
git remote add origin https://github.com/mrstxt/flowdesk.git
git branch -M main
git push -u origin main
```

2. Vercel’da yangi project oching:

`https://vercel.com/new`

GitHubdagi `mrstxt/flowdesk` reposini tanlang.

3. Vercel project settings ichida Environment Variables qo'shing:

```env
DATABASE_URL="postgresql://..."
SESSION_SECRET="..."
ADMIN_USERNAME="..."
ADMIN_PASSWORD="..."
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_ADMIN_CHAT_ID="..."
BOT_WEBHOOK_SECRET="..."
VERCEL_CRON_SECRET="..."
```

4. Deploydan oldin database jadvallarini yarating:

```bash
DATABASE_URL="postgresql://..." npm run db:push
```

Yoki local `.env` to'ldirilgan bo'lsa:

```bash
npm run db:push
```

5. Vercel deploy qiling.

## Telegram Bot Sozlash

1. @BotFather’dan bot token oling va `TELEGRAM_BOT_TOKEN`ga qo'ying.

2. @userinfobot orqali chat ID oling va `TELEGRAM_ADMIN_CHAT_ID`ga qo'ying.

3. Webhook secret yarating va `BOT_WEBHOOK_SECRET`ga qo'ying.

4. Deploydan keyin webhookni ulang:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://SIZNING_DOMEN/api/bot&secret_token=<BOT_WEBHOOK_SECRET>
```

Masalan:

```text
https://api.telegram.org/bot123456:ABC/setWebhook?url=https://flowdesk.vercel.app/api/bot&secret_token=my-secret
```

## Cron Sozlash

Vercel Project → Settings → Cron Jobs:

| Field | Qiymat |
|---|---|
| URL | `/api/cron/discipline` |
| Schedule | `*/30 * * * *` |

Cron endpoint `VERCEL_CRON_SECRET` orqali himoyalanadi. Agar Vercel Cron header yubormasa, endpoint public ishlamasligi uchun secretni to'g'ri sozlang.

## Foydali Komandalar

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run db:push
```

## Bot Buyruqlari

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
| Rejalar | `/rejalarni` |
| Statistika | `/stat`, `/bugun`, `/buyurtmalar` |
| Bot yoqish | `/bot_yoq` |
| Bot o'chirish | `/bot_och` |

## Muhim Eslatma

Productionda `ADMIN_PASSWORD`, `SESSION_SECRET`, `BOT_WEBHOOK_SECRET`, `VERCEL_CRON_SECRET` qiymatlarini oddiy yoki default qoldirmang. Har birini uzun random satr qilib qo'ying.
