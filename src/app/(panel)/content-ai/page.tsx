"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Camera,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  Heart,
  LineChart,
  MessageCircle,
  MessageSquareText,
  Play,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Target,
  UserRound,
  Wand2,
} from "lucide-react";

type InstagramProfile = {
  username: string;
  followers: number;
  mediaCount: number;
  profileUrl: string;
} | null;

type InstagramMedia = {
  id: string;
  title: string;
  type: "reel" | "post" | "story";
  postedAt: string;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  retention: number;
  watchTime: number;
  aiScore: number;
};

type InstagramComment = {
  id: string;
  mediaTitle: string;
  author: string;
  text: string;
  sentiment: "positive" | "neutral" | "negative";
  createdAt: string;
};

const profile: InstagramProfile = null;
const media: InstagramMedia[] = [];
const comments: InstagramComment[] = [];
const contentPlan: Array<{
  day: string;
  title: string;
  type: string;
  score: number;
}> = [];

function formatNumber(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(value);
}

function improveScript(script: string) {
  const clean = script.trim();

  if (!clean) {
    return "Senariy yozing. Profil statistikasi ulangandan keyin AI uni real retention, komment va saqlash patternlariga qarab yaxshilaydi.";
  }

  return [
    "Hook: asosiy og'riqni birinchi 2 soniyada ayting.",
    "",
    `Qayta ishlanadigan matn: ${clean.replace(/\.$/, "")}.`,
    "",
    "AI profil ulangandan keyin bu senariyni sizning eng kuchli video, komment va retention patternlaringizga moslab scoring qiladi.",
    "",
    "CTA: bitta aniq harakat qoldiring: izoh, saqlash yoki DM.",
  ].join("\n");
}

export default function ContentAiPage() {
  const [connectStarted, setConnectStarted] = useState(false);
  const [script, setScript] = useState("");
  const [generated, setGenerated] = useState(() => improveScript(""));

  const totals = useMemo(() => {
    const views = media.reduce((sum, item) => sum + item.views, 0);
    const reach = media.reduce((sum, item) => sum + item.reach, 0);
    const saves = media.reduce((sum, item) => sum + item.saves, 0);
    const shares = media.reduce((sum, item) => sum + item.shares, 0);
    const commentsCount = media.reduce((sum, item) => sum + item.comments, 0);
    const retention = media.length
      ? Math.round(
          media.reduce((sum, item) => sum + item.retention, 0) / media.length
        )
      : 0;

    return { views, reach, saves, shares, commentsCount, retention };
  }, []);

  const hasMedia = media.length > 0;
  const hasComments = comments.length > 0;

  function handleConnect() {
    setConnectStarted(true);
  }

  function handleGenerate() {
    setGenerated(improveScript(script));
  }

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-accent mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Instagram profilingiz uchun AI content laboratoriya
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Content AI
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            Profil ulangandan keyin reels, post, koment, reach, view, save,
            share va retention statistikalarini shu yerda o'qiydi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
          >
            {connectStarted ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {connectStarted ? "Ulash jarayoni tayyor" : "Instagram ulash"}
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-black/[0.07] dark:border-white/[0.09] rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all">
            <RefreshCw className="w-4 h-4 text-[#0a84ff]" />
            Statistika yangilash
          </button>
        </div>
      </div>

      <section className="mb-6 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
              <UserRound className="w-7 h-7" />
            </div>
            <div>
              <div className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                {profile?.username || "Instagram profil ulanmagan"}
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {profile
                  ? `${formatNumber(profile.followers)} obunachi · ${formatNumber(profile.mediaCount)} media`
                  : "Profil ulangandan keyin bio, obunachi va media statistikasi chiqadi."}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Profil", "Reels", "Postlar", "Kommentlar", "AI training"].map(
              (item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400"
                >
                  {item}
                </span>
              )
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <Kpi label="Ko'rish" value={formatNumber(totals.views)} icon={Eye} tone="blue" />
        <Kpi label="Reach" value={formatNumber(totals.reach)} icon={Target} tone="purple" />
        <Kpi label="Saqlash" value={formatNumber(totals.saves)} icon={Save} tone="green" />
        <Kpi label="Ulashish" value={formatNumber(totals.shares)} icon={Send} tone="accent" />
        <Kpi label="Komment" value={formatNumber(totals.commentsCount)} icon={MessageCircle} tone="orange" />
        <Kpi label="Retention" value={`${totals.retention}%`} icon={LineChart} tone="blue" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6 mb-6">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Profil kontentlari
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Har bir video qanday ketayotgani, view, koment, save va AI score.
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-accent" />
          </div>

          {hasMedia ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-black/[0.06] dark:border-white/[0.08]">
                    <th className="py-3 pr-4 font-bold">Kontent</th>
                    <th className="py-3 px-4 font-bold">View</th>
                    <th className="py-3 px-4 font-bold">Reach</th>
                    <th className="py-3 px-4 font-bold">Komment</th>
                    <th className="py-3 px-4 font-bold">Save</th>
                    <th className="py-3 pl-4 font-bold">AI score</th>
                  </tr>
                </thead>
                <tbody>
                  {media.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-black/[0.04] dark:border-white/[0.06]"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-400">{item.postedAt}</div>
                      </td>
                      <td className="py-3 px-4">{formatNumber(item.views)}</td>
                      <td className="py-3 px-4">{formatNumber(item.reach)}</td>
                      <td className="py-3 px-4">{formatNumber(item.comments)}</td>
                      <td className="py-3 px-4">{formatNumber(item.saves)}</td>
                      <td className="py-3 pl-4 font-bold text-accent">
                        {item.aiScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={Play}
              title="Hali video statistikasi yo'q"
              text="Instagram profil ulangandan keyin har bir reels va post shu jadvalda real raqamlari bilan chiqadi."
            />
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Komment tahlili
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Savollar, e'tirozlar, sentiment va kontent g'oyalari.
              </p>
            </div>
            <MessageSquareText className="w-5 h-5 text-[#0a84ff]" />
          </div>

          {hasComments ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      @{comment.author}
                    </div>
                    <span className="text-xs text-slate-400">
                      {comment.sentiment}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {comment.text}
                  </p>
                  <div className="text-xs text-slate-400 mt-2">
                    {comment.mediaTitle}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="Kommentlar hali o'qilmagan"
              text="Profil ulangandan keyin AI komentlarni guruhlaydi: savol, norozilik, qiziqish, xarid signali va yangi video g'oya."
            />
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Script Studio
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Profil data kelgandan keyin senariy real patternlarga moslanadi.
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
                placeholder="Reels senariyingizni shu yerga yozing..."
                className="mt-2 w-full min-h-[260px] resize-none rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm leading-6 text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                AI variant
              </label>
              <pre className="mt-2 min-h-[260px] whitespace-pre-wrap rounded-2xl border border-accent/15 bg-accent-soft/60 px-4 py-3 text-sm leading-6 text-slate-800 dark:text-slate-100">
                {generated}
              </pre>
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                AI training holati
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Model profil statistikasi yig'ilgandan keyin o'qishni boshlaydi.
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-accent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <TrainingCard icon={Eye} label="Media o'qildi" value="0" />
            <TrainingCard icon={MessageCircle} label="Komment o'qildi" value="0" />
            <TrainingCard icon={Heart} label="Engagement signal" value="0" />
            <TrainingCard icon={LineChart} label="Pattern topildi" value="0" />
          </div>

          <div className="rounded-2xl bg-[#eef7ff] border border-[#0a84ff]/10 p-4 flex items-start gap-3">
            <ClipboardList className="w-5 h-5 text-[#0a84ff] mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-6">
              Bu bo'lim real Instagram profil ulanadigan qilib tayyorlandi.
              Data kelganda AI har bir kontentni, kommentlarni va ko'rilish
              patternlarini alohida tahlil qiladi.
            </p>
          </div>
        </section>
      </div>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
              Content Plan
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Reja faqat profil statistikasi o'qilgandan keyin tuziladi.
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-black/[0.07] dark:border-white/[0.09] text-slate-700 dark:text-slate-200 rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all">
            <CalendarDays className="w-4 h-4 text-[#34c759]" />
            Reja tuzish
          </button>
        </div>

        {contentPlan.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {contentPlan.map((item) => (
              <div
                key={`${item.day}-${item.title}`}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4 bg-slate-50/70 dark:bg-slate-950"
              >
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  {item.day}
                </div>
                <div className="font-display font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                  {item.title}
                </div>
                <div className="mt-3 text-xs text-accent font-bold">
                  {item.score} score
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="Content plan hali yo'q"
            text="AI profil ichidagi videolar va kommentlarni o'qigandan keyin keyingi postlar rejasini beradi."
          />
        )}
      </section>
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
  tone: "blue" | "green" | "purple" | "accent" | "orange";
}) {
  const tones = {
    blue: "bg-[#eaf4ff] text-[#0a84ff]",
    green: "bg-[#eaf9ef] text-[#22a447]",
    purple: "bg-[#f5edff] text-[#8f35d5]",
    accent: "bg-accent-soft text-accent",
    orange: "bg-[#fff4d8] text-[#b76a00]",
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
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tones[tone]}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Play;
  title: string;
  text: string;
}) {
  return (
    <div className="min-h-[220px] rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.12] bg-slate-50/70 dark:bg-slate-950 flex flex-col items-center justify-center text-center px-6 py-10">
      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 text-slate-400 flex items-center justify-center mb-3 shadow-sm">
        <Icon className="w-6 h-6" />
      </div>
      <div className="font-display font-extrabold text-slate-900 dark:text-slate-100">
        {title}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 max-w-md mt-1">
        {text}
      </p>
    </div>
  );
}

function TrainingCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {label}
          </div>
          <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {value}
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 text-slate-400 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
