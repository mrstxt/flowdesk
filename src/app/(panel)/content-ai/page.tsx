"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Camera,
  Eye,
  Flame,
  LineChart,
  Link2,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";

type Reel = {
  title: string;
  format: string;
  views: number;
  saves: number;
  shares: number;
  retention: number;
  hook: string;
};

const reels: Reel[] = [
  {
    title: "Freelancer narxni qanday aytadi?",
    format: "Storytelling",
    views: 18400,
    saves: 612,
    shares: 224,
    retention: 71,
    hook: "Narx aytganda mijoz jim bo'lib qolsa...",
  },
  {
    title: "1 kunda portfolio tartiblash",
    format: "Checklist",
    views: 12900,
    saves: 488,
    shares: 156,
    retention: 64,
    hook: "Portfolio ko'rsatadi, gapirmaydi.",
  },
  {
    title: "Buyurtmani yopadigan 3 savol",
    format: "Education",
    views: 26700,
    saves: 934,
    shares: 391,
    retention: 78,
    hook: "Mijozga darrov narx yubormang.",
  },
  {
    title: "Oddiy CRM bilan tartib",
    format: "Demo",
    views: 9400,
    saves: 211,
    shares: 72,
    retention: 58,
    hook: "Ishlar tarqalib ketmasin desangiz...",
  },
];

const contentPlan = [
  {
    day: "Dushanba",
    title: "Mijozni yo'qotadigan 3 ta xato",
    type: "Pain point",
    score: 91,
  },
  {
    day: "Seshanba",
    title: "Buyurtma kelganda birinchi xabar shabloni",
    type: "Template",
    score: 86,
  },
  {
    day: "Payshanba",
    title: "Portfolio postni reelsga aylantirish",
    type: "How-to",
    score: 82,
  },
  {
    day: "Shanba",
    title: "Haftalik natija: buyurtma, foyda, intizom",
    type: "Build in public",
    score: 78,
  },
];

const defaultScript =
  "Bugun men freelancerlar uchun ishlarni qanday tartibga solishni ko'rsataman. Avval buyurtmalarni yozib boring, keyin to'lovlarni ajrating, keyin maqsad qo'ying.";

function formatNumber(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(value);
}

function improveScript(script: string) {
  const clean = script.trim();
  if (!clean) {
    return "Avval senariy yozing. AI hook, tempo va CTA bo'yicha yaxshilangan variant beradi.";
  }

  return [
    "Hook: Freelancer bo'lsangiz, ish ko'paygani yaxshi. Lekin tartib yo'qolsa, pul ham yo'qoladi.",
    "",
    "Asosiy qism: Bugun 3 qadamni ko'rsating: buyurtmani bosqichlarga ajrating, har to'lovni kartaga yozing, foydadan maqsadga avtomatik ulush ajrating.",
    "",
    "Retention nuqtasi: Ekranda real misol ko'rsating va har qadamni 4-5 soniyada almashtiring.",
    "",
    `Qayta ishlangan matn: ${clean.replace(/\.$/, "")}. Buni qisqa ekran yozuvi, tez montaj va bitta aniq natija bilan yoping.`,
    "",
    "CTA: Shu sistemani o'zingizga moslab ko'rmoqchi bo'lsangiz, izohga 'flow' deb yozing.",
  ].join("\n");
}

export default function ContentAiPage() {
  const [connected, setConnected] = useState(false);
  const [script, setScript] = useState(defaultScript);
  const [activeFormat, setActiveFormat] = useState("Storytelling");
  const [generated, setGenerated] = useState(() => improveScript(defaultScript));

  const totals = useMemo(() => {
    const views = reels.reduce((sum, reel) => sum + reel.views, 0);
    const saves = reels.reduce((sum, reel) => sum + reel.saves, 0);
    const shares = reels.reduce((sum, reel) => sum + reel.shares, 0);
    const retention = Math.round(
      reels.reduce((sum, reel) => sum + reel.retention, 0) / reels.length
    );

    return { views, saves, shares, retention };
  }, []);

  const selectedReels = reels.filter((reel) => reel.format === activeFormat);
  const bestReel = [...reels].sort((a, b) => b.retention - a.retention)[0];

  function handleGenerate() {
    setGenerated(improveScript(script));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-accent mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Instagram uchun AI tahlil va senariy laboratoriyasi
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Content AI
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            Reels natijalarini o'qing, kuchli patternlarni toping va har bir
            senariyni ko'proq ko'rilishga moslab qayta ishlang.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setConnected((value) => !value)}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
          >
            {connected ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {connected ? "Instagram ulangan" : "Instagram ulash"}
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-black/[0.07] dark:border-white/[0.09] rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all">
            <RefreshCw className="w-4 h-4 text-[#0a84ff]" />
            Tahlilni yangilash
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi label="Jami ko'rish" value={formatNumber(totals.views)} icon={Eye} tone="blue" />
        <Kpi label="Saqlashlar" value={formatNumber(totals.saves)} icon={Save} tone="green" />
        <Kpi label="Ulashishlar" value={formatNumber(totals.shares)} icon={Send} tone="purple" />
        <Kpi label="Retention" value={`${totals.retention}%`} icon={LineChart} tone="accent" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Script Studio
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Hook, tempo, retention va CTA bo'yicha qayta yozish.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all"
            >
              <Wand2 className="w-4 h-4" />
              Yaxshilash
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Original senariy
              </label>
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="mt-2 w-full min-h-[280px] resize-none rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                AI variant
              </label>
              <pre className="mt-2 min-h-[280px] whitespace-pre-wrap rounded-2xl border border-accent/15 bg-accent-soft/60 px-4 py-3 text-sm leading-6 text-slate-800 dark:text-slate-100">
                {generated}
              </pre>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                AI Insight
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Eng kuchli format va keyingi fokus.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#fff4d8] text-[#b76a00] flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Top pattern
            </div>
            <div className="font-display font-extrabold text-slate-900 dark:text-slate-100">
              {bestReel.hook}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Qisqa og'riq nuqtasi bilan boshlagan videolarda retention yuqori.
              Dastlabki 2 soniyada muammo va va'dani birga bering.
            </p>
          </div>

          <div className="space-y-3">
            <Insight icon={Target} title="Hook" text="Savol emas, vaziyatdan boshlang: mijoz, pul, tartib yoki xato." />
            <Insight icon={Play} title="Tempo" text="Har 4-5 soniyada ekran, kadr yoki matn ritmini almashtiring." />
            <Insight icon={MessageCircle} title="CTA" text="Izohga bitta kalit so'z yozdiring, umumiy chaqiriqlarni kamaytiring." />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.8fr_1.2fr] gap-6">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Formatlar
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Qaysi uslub ko'proq natija berayotganini solishtiring.
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-accent" />
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {["Storytelling", "Checklist", "Education", "Demo"].map((format) => (
              <button
                key={format}
                onClick={() => setActiveFormat(format)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  activeFormat === format
                    ? "bg-accent text-white shadow-lg shadow-accent/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {format}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {(selectedReels.length ? selectedReels : reels).map((reel) => (
              <div
                key={reel.title}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {reel.title}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{reel.hook}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {reel.retention}%
                    </div>
                    <div className="text-[11px] text-slate-400">retention</div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${reel.retention}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                7 kunlik Content Plan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                AI top patternlardan kelib chiqib keyingi postlarni tartiblaydi.
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-black/[0.07] dark:border-white/[0.09] text-slate-700 dark:text-slate-200 rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all">
              <CalendarDays className="w-4 h-4 text-[#34c759]" />
              Reja tuzish
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contentPlan.map((item) => (
              <div
                key={item.day}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-slate-950"
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    {item.day}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-accent">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    {item.score} score
                  </span>
                </div>
                <div className="font-display font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                  {item.title}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-black/[0.06] dark:border-white/[0.08]">
                    {item.type}
                  </span>
                  <Link2 className="w-4 h-4 text-slate-300" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl bg-[#eef7ff] border border-[#0a84ff]/10 p-4 flex items-start gap-3">
            <ClipboardList className="w-5 h-5 text-[#0a84ff] mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-6">
              Keyingi bosqichda Instagram Graph API orqali real insights olinadi,
              keyin esa har bir akkauntga mos scoring modeli qo'shiladi.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Eye;
  tone: "blue" | "green" | "purple" | "accent";
}) {
  const tones = {
    blue: "bg-[#eaf4ff] text-[#0a84ff]",
    green: "bg-[#eaf9ef] text-[#22a447]",
    purple: "bg-[#f5edff] text-[#8f35d5]",
    accent: "bg-accent-soft text-accent",
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
          <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {value}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function Insight({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Target;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {title}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">
          {text}
        </p>
      </div>
    </div>
  );
}
