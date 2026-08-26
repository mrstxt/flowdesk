# FlowDesk

FlowDesk — shaxsiy admin panel: buyurtmalar, moliya, maqsadlar, intizom, kitoblar, rivojlanish videolari va Telegram intizom bot. **Vercel'ga deploy qilingan** va **doim Light (yorug') rejimda** ishlaydi.

> ☀️ **Light mode majburiy.** Kompyuter/telefon dark mode'da bo'lsa ham loyiha doim yorug' ko'rinishda chiqadi. Buning sababi: `dark:` Tailwind varianti klass-asosli qilingan (`.dark` klassi hech qachon qo'shilmaydi), OS `prefers-color-scheme` e'tiborga olinmaydi.

## Imkoniyatlar

| Bo'lim | Nima qiladi |
|---|---|
| Dashboard | KPI, sof foyda (asosiy kartada), vazifalar, intizom, maqsad progressi |
| Buyurtmalar | Kanban uslubida buyurtmalarni yuritish |
| Hisob-kitob | Kirim/chiqim, **Transaksiyalar** (kunlar bo'yicha), oylik grafiklar |
| Maqsadlar | Jamg'arma, avtomatik foiz va karta balansini boshqarish |
| Intizom | Uyg'onish/uxlash va kunlik reja nazorati |
| Kitoblar | O'qish progressi, qaydlar va PDF variant |
| Rivojlanish | YouTube video ro'yxati, fikrlar va resume |
| Analitika | Oylik taqqoslash va tavsiyalar |
| Telegram bot | Buyurtma, kirim, chiqim, vazifa, maqsad va intizom buyruqlari |

## Pul oqimi (muhim tushuncha)

Barcha pul oqimi **asosiy karta** (`primary` tipidagi karta) orqali ishlaydi:

- Buyurtma tasdiqlanganda pul **asosiy kartaga** tushadi
- Buyurtma foizi (avtomatik %) **asosiy kartadan maqsad kartasiga** tranzaksiya bo'lib o'tadi
- Chiqim har doim **asosiy kartadan** yechiladi
- Maqsadga qo'lda pul ajratish ham **asosiy kartadan** olinadi
- `source="goal"` (ichki transfer) kirimlar sof foyda hisobiga kirmaydi — sof foyda real daromadni ko'rsatadi
- Dashboardda asosiy karta yonida **"Sof foyda (oy)"** ko'rsatiladi

## Loyiha tuzilishi

```text
src/
├── app/
│   ├── (panel)/          # Login bo'lgandan keyingi sahifalar (dashboard, orders, finance, goals, ...)
│   ├── api/              # Next.js API route'lar (bot, cron, incomes, expenses, goals, cards, ...)
│   ├── login/            # Login sahifasi
│   ├── layout.tsx        # Root layout (ThemeProvider bilan)
│   └── globals.css       # Tailwind v4 + dark variant sozlamasi
├── components/           # Sidebar, Modal, ThemeProvider
├── db/
│   ├── schema.ts         # Drizzle schema (barcha jadvallar)
│   └── index.ts          # DB ulanish
└── lib/
    ├── cardActions.ts    # Karta operatsiyalari (transfer, maqsadga pul qo'shish)
    ├── orderActions.ts   # Buyurtma tasdiqlash + avtomatik foiz taqsimoti
    ├── auth.ts           # Sessiya autentifikatsiyasi
    └── utils.ts          # Valyuta/sana yordamchilari
```

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

Vercel’da login ishlashi uchun shu 4 ta env majburiy:

```env
DATABASE_URL="postgresql://..."
SESSION_SECRET="uzun-random-secret"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="siz-kiritadigan-parol"
```

### Telegram Bot Uchun

| Kalit | Misol | Izoh |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | @BotFather bergan bot token |
| `TELEGRAM_ADMIN_CHAT_ID` | `123456789` | Sizning Telegram chat ID. @userinfobot orqali olinadi |
| `BOT_WEBHOOK_SECRET` | `random-webhook-secret` | Telegram webhook so'rovlarini tekshirish uchun maxfiy satr |
| `VERCEL_CRON_SECRET` | `random-cron-secret` | Vercel Cron endpointini himoya qilish uchun maxfiy satr |
| `CRON_JOB_SECRET` | `random-cron-job-secret` | cron-job.org real-time tekshiruvlarini himoya qilish uchun maxfiy satr (`?tick=` parametri) |

### Content AI Instagram Ulanishi Uchun

Content AI profilni Instagram orqali tasdiqlatib ulashi uchun Meta/Instagram app kerak. App ichida callback URL sifatida quyidagini qo'shing:

```text
https://SIZNING_DOMEN/api/instagram/callback
```

Local dev uchun:

```text
http://localhost:3000/api/instagram/callback
```

Env kalitlari:

| Kalit | Misol | Izoh |
|---|---|---|
| `INSTAGRAM_APP_ID` | `1234567890` | Meta/Instagram app client ID |
| `INSTAGRAM_APP_SECRET` | `abc123...` | Meta/Instagram app secret. Clientga chiqmaydi |
| `INSTAGRAM_REDIRECT_URI` | `https://domain.uz/api/instagram/callback` | Meta dashboarddagi callback URL bilan bir xil bo'lishi shart |
| `INSTAGRAM_API_VERSION` | `v21.0` | Ixtiyoriy, default `v21.0` |
| `INSTAGRAM_SCOPES` | `instagram_business_basic,instagram_business_manage_insights,instagram_business_manage_comments` | Ixtiyoriy, kerakli permissionlar |

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

### Neon `flowdesk` Database Ulanishi

Neon ichida bir nechta database bo'lishi mumkin. URL oxiridagi path qaysi databasega ulanishini belgilaydi:

```text
postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
postgresql://USER:PASSWORD@HOST/flowdesk?sslmode=require
```

Bu loyihada sayt `flowdesk` database bilan ishlashi kerak bo'lsa, `DATABASE_URL` ichida `/flowdesk` bo'lishi shart. Agar URL `/neondb` bo'lib qolsa, app boshqa databasega ulanadi va saytda data yo'qdek ko'rinishi mumkin.

Local ishlatishda `.env.local` yoki `.env` ichiga qo'ying:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/flowdesk?sslmode=require&channel_binding=require"
```

Jadvallar hali yaratilmagan bo'lsa:

```bash
npm run db:init
```

Yoki Drizzle schema push uchun:

```bash
npm run db:push
```

Vercel saytga ulash uchun:

1. Vercel Dashboard → Project `flowdesk` → Settings → Environment Variables oching.
2. `DATABASE_URL` qiymatini `/flowdesk` bilan tugaydigan Neon URLga almashtiring.
3. O'zgarishdan keyin projectni redeploy qiling.
4. Deploydan keyin health endpointni tekshiring:

```text
https://SIZNING_DOMEN/api/health
```

To'g'ri ulansa:

```json
{"ok":true,"database":"connected","schema":"ready"}
```

Neon'da `Your account or project has exceeded the compute time quota` chiqsa, database URL to'g'ri bo'lsa ham sayt data o'qiy olmaydi. Bunda Neon compute quota ochilishi yoki plan yangilanishi kerak.

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

## Cron Sozlash (Real-Time Ogohlantirishlar)

Ogohlantirishlar (uyg'onish, uxlash, rejalar) **Toshkent vaqti bo'yicha real-time** yuboriladi. Endi ular cronning qat'iy vaqtiga bog'liq emas — **belgilangan vaqt kelishi bilan** xabar ketadi (masalan uxlash 20:00 qilingan bo'lsa, Toshkentda 20:00 bo'lishi bilan).

### Qanday ishlaydi

1. **Asosiy haydovchi — [cron-job.org](https://cron-job.org)** (bepul): har **5 daqiqada** quyidagi URL'ni chaqiradi:

```text
https://SIZNING_DOMEN/api/cron/discipline?tick=CRON_JOB_SECRET
```

2. Endpoint har safar Toshkent vaqtini hisoblab, har bir eslatma uchun belgilangan vaqtga solishtiradi. Vaqt keldimi — xabar yuboriladi (±5 daqiqa aniqlik).

3. `bot_reminders` jadvali kuniga har bir eslatma **faqat 1 marta** yuborilishini kafolatlaydi (takrorlanmaydi).

4. `vercel.json` dagi kunlik crons endi **backup** vazifasini bajaradi — agar cron-job.org biror sabab bilan ishlamay qolsa ham eslatmalar yo'qolmaydi.

### cron-job.org sozlash (2 daqiqa)

1. `CRON_JOB_SECRET` uchun uzun random satr yarating va Vercel env'ga qo'ying (masalan `8f3a...uzun`).

2. [cron-job.org](https://cron-job.org) da bepul akkaunt oching.

3. **Create cronjob** tugmasini bosing va to'ldiring:
   - **Title:** `FlowDesk reminders`
   - **URL:** `https://SIZNING_DOMEN/api/cron/discipline?tick=SIZNING_CRON_JOB_SECRET`
   - **Execution schedule:** har 5 daqiqa (`*/5 * * * *`)
   - **HTTP method:** GET (default)

4. **Create** tugmasini bosing — ishlay boshlaydi.

Test: endpointni brauzerda `https://SIZNING_DOMEN/api/cron/discipline?force=true&tick=SIZNING_CRON_JOB_SECRET` ochib, barcha eslatmalar darhol yuborilishini tekshirishingiz mumkin. (Production'da secretlar o'rnatilgan bo'lsa `force` ham auth'dan o'tishi shart — `tick` parametrini qo'shing. Local'da secretlar bo'lmasa `?force=true` o'zi ham ishlaydi.)

### Vercel Cron (backup)

`vercel.json` faylidagi kunlik crons backup sifatida qoladi. Vercel Hobby (bepul) planda cron kuniga ko'pi bilan 1 marta ishlaydi, shuning uchun bir nechta kunlik schedule ishlatilgan:

```json
{
  "crons": [
    { "path": "/api/cron/discipline", "schedule": "30 23 * * *" },
    { "path": "/api/cron/discipline", "schedule": "0 5 * * *" },
    { "path": "/api/cron/discipline", "schedule": "0 15 * * *" },
    { "path": "/api/cron/discipline", "schedule": "40 16 * * *" },
    { "path": "/api/cron/discipline", "schedule": "0 18 * * *" }
  ]
}
```

Endpoint auth: `VERCEL_CRON_SECRET` (Vercel Cron header) yoki `CRON_JOB_SECRET` (`?tick=` parametri) orqali himoyalanadi. Ikkalasi ham bo'lmasa — dev rejimi (ochiq).

**Eslatma:** Cron ishga tushganda, Vercel Logs ichida `/api/cron/discipline` GET so'rovlari ko'rinadi. Xato bo'lsa `error` maydoni bilan 500 qaytadi va `console.error` xabarlari chiqadi.

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

### Bot tugmalari (Reply Keyboard)

Botda pastdagi klaviatura orqali tez ishlash mumkin. Tugmalar:

| Tugma | Nima qiladi |
|---|---|
| 📋 Rejalar | Bugungi rejalarni ko'rsatadi |
| 📅 Bugungi vazifalar | Bugungi tasklarni ko'rsatadi |
| ➕ Buyurtma | Buyurtma qo'shishni boshlaydi (bosqichma-bosqich) |
| 💸 Chiqim | Chiqim qo'shishni boshlaydi |
| 💰 Kirim | Kirim qo'shishni boshlaydi |
| 📊 Statistika | Oylik statistikani ko'rsatadi |
| 📚 Kitob qo'shish | Kitob qo'shadi (nom, muallif, sahifa, PDF havola) |
| 🎬 Video qo'shish | Video qo'shadi (YouTube havola, nom, kategoriya) |
| 🎯 Maqsad | Maqsad yaratadi (nom, summa, avtomatik foiz) |
| 🔔 Botni yoqish | Eslatmalarni yoqadi |
| 🔕 Botni o'chirish | Eslatmalarni o'chiradi |
| 🏠 Menyu | Asosiy menyuga qaytadi |
| ❌ Bekor | Kiritish jarayonini bekor qiladi |
| ❓ Yordam | Barcha buyruqlar ro'yxati |

**Kitob qo'shish** tugmasi bosilganda bot 4 bosqichda so'raydi: nom → muallif → sahifalar soni → PDF varianti havolasi. Har qadamda "❌ Bekor" tugmasi orqali chiqish mumkin.

## Video Resume (pauza qilinsa davom ettirish)

YouTube videolar panelida "Rivojlanish" bo'limida:

1. Video ko'rishni boshlang — har 5 soniyada `currentTime` serverga saqlanadi
2. Pauza qilib, keyin sahifani tark etsangiz ham progress saqlanib qoladi
3. Video kartasida "**X daqiqa Y soniya ko'rilgan**" yozuvi va "▶️ Davom ettirish" tugmasi paydo bo'ladi
4. "Davom ettirish" bosilganda iframe o'sha daqiqadan boshlanadi

Bunda YouTube IFrame API (`enablejsapi=1`) ishlatiladi va `?start=NN` parametri URLga qo'shiladi.

## Kitob PDF varianti

Kitob qo'shish formasida endi **PDF varianti havolasi** maydoni bor (ixtiyoriy). Havola kiritilsa, kitob kartasida qizil "📄 PDF" tugmasi paydo bo'lib, yangi tabda ochiladi.

Buni Telegram bot orqali ham qilish mumkin — `/kitob qilish` tugmasini bosing yoki bot menyudan "📚 Kitob qo'shish"ni tanlang.

## Muhim Eslatma

Productionda `ADMIN_PASSWORD`, `SESSION_SECRET`, `BOT_WEBHOOK_SECRET`, `VERCEL_CRON_SECRET` qiymatlarini oddiy yoki default qoldirmang. Har birini uzun random satr qilib qo'ying.

## Login Muammolari

Vercel logs ichida:

| Status | Sabab |
|---|---|
| `GET / 307` | Normal holat. Login qilinmagan foydalanuvchi `/login`ga redirect bo'ladi |
| `GET /login 200` | Normal holat. Login sahifasi ochilgan |
| `POST /api/auth/login 400` | Login yoki parol input bo'sh/yaroqsiz ketgan |
| `POST /api/auth/login 401` | `ADMIN_USERNAME` yoki `ADMIN_PASSWORD` qiymatiga mos login/parol kiritilmagan |
| `POST /api/auth/login 500` | Vercel env ichida `SESSION_SECRET`, `ADMIN_USERNAME` yoki `ADMIN_PASSWORD` yetishmayapti |

Agar `401` chiqsa, Vercel → Project → Settings → Environment Variables ichidagi `ADMIN_USERNAME` va `ADMIN_PASSWORD`ni tekshiring. Keyin projectni redeploy qiling.

## Ma'lumotlar Saqlanmasa Yoki Bot Xato Bersa

Agar panelda amallar refreshdan keyin yo'qolsa yoki bot `❌ Xatolik yuz berdi` desa, frontend ishlayapti, lekin API databasega yoza olmayapti.

1. Vercel’da `DATABASE_URL` borligini tekshiring:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

2. Env qo'shgandan keyin Vercel’da redeploy qiling.

3. Database jadvallarini yarating:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" npm run db:push
```

4. Deploy qilingan saytda health endpointni oching:

```text
https://SIZNING_DOMEN/api/health
```

To'g'ri holat:

```json
{"ok":true,"database":"connected","schema":"ready"}
```

Xato holatlar:

| Code | Nima qilish kerak |
|---|---|
| `database_not_configured` | Vercel envga `DATABASE_URL` qo'ying va redeploy qiling |
| `database_schema_missing` | `npm run db:push` bilan jadvallarni yarating |
| `database_connection_failed` | `DATABASE_URL` login/parol/host qiymatini tekshiring |
| `database_error` | Vercel Logs ichidagi `Health check failed` xabarini tekshiring |

Vercel logda `getaddrinfo ENOTFOUND base` chiqsa, `DATABASE_URL` noto'g'ri. Host `base` bo'lib qolgan degani. `DATABASE_URL` hech qachon `base` bo'lmasligi kerak; u Neon/Supabase/Vercel Postgres bergan to'liq URL bo'lishi kerak:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
```

Masalan Neon URL ko'rinishi:

```env
DATABASE_URL="postgresql://neondb_owner:PAROL@ep-something.region.aws.neon.tech/neondb?sslmode=require"
```
