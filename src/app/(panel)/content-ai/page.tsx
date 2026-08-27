"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Camera,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  Heart,
  Lightbulb,
  LineChart,
  Link2,
  Lock,
  MessageCircle,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  Wand2,
  Zap,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type InstagramProfile = {
  id?: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
  mediaCount: number;
  profileUrl: string;
  connectedAt?: string;
};

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

type InspirationProfile = {
  id: string;
  username: string;
  status: "queued" | "connected" | "analyzing";
  mediaRead: number;
  topVideos: number;
  patterns: number;
};

type WinningPattern = {
  id: string;
  source: "my-profile" | "inspiration";
  title: string;
  detail: string;
  confidence: number;
};

type ContentIdea = {
  id: string;
  title: string;
  source: string;
  score: number;
};

type AnalysisResult = {
  analyzedAt: string;
  readiness: number;
  summary: {
    profileConnected: boolean;
    profileUsername: string | null;
    inspirationProfiles: number;
    mediaCount: number;
    commentsCount: number;
    patternCount: number;
    signalCount: number;
  };
  recommendations: string[];
};

type SectionId =
  | "overview"
  | "profile"
  | "inspiration"
  | "ml-data"
  | "studio"
  | "plan";

const media: InstagramMedia[] = [];
const comments: InstagramComment[] = [];
const winningPatterns: WinningPattern[] = [];
const contentIdeas: ContentIdea[] = [];
const contentPlan: Array<{
  day: string;
  title: string;
  type: string;
  score: number;
}> = [];

const growthFocus = [
  {
    title: "Bio va offer",
    text: "Profil birinchi 5 soniyada kimga qanday natija berishini aniq aytishi kerak.",
    status: "Profil data kutilmoqda",
  },
  {
    title: "Hook laboratoriya",
    text: "AI eng yaxshi retention bergan birinchi 2 soniya formulalarini ajratadi.",
    status: "Reels insight kutilmoqda",
  },
  {
    title: "Content pillar",
    text: "Audience savollari va yaxshi ketgan mavzulardan 3-5 ta asosiy yo'nalish tuziladi.",
    status: "Komment va benchmark kutilmoqda",
  },
  {
    title: "Conversion CTA",
    text: "Saqlash, izoh, DM yoki sotuvga olib boradigan bitta aniq chaqiriq tanlanadi.",
    status: "Performance signal kutilmoqda",
  },
];

const marketingActions = [
  "Profil positioning audit",
  "7 kunlik reels sprint",
  "Hook A/B variantlar",
  "Caption va CTA generator",
  "Benchmark pattern extract",
  "Kommentlardan kontent g'oya",
];

const pipeline = [
  {
    title: "Profil ulash",
    text: "OAuth ruxsatlari orqali profil aniqlanadi, parol app ichida olinmaydi.",
  },
  {
    title: "Kontent o'qish",
    text: "Reels, post, reach, view, save, share, comment va retention yig'iladi.",
  },
  {
    title: "Pattern topish",
    text: "Mening profilim va ilhom profillaridagi yaxshi ketgan formatlar ajratiladi.",
  },
  {
    title: "AI tavsiya",
    text: "Senariy, hook, caption, CTA va kontent reja real signalga asoslanadi.",
  },
];

const sections: Array<{ id: SectionId; label: string; icon: typeof Eye }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "profile", label: "My Profile", icon: UserRound },
  { id: "inspiration", label: "Inspiration", icon: Search },
  { id: "ml-data", label: "Analitika/ML", icon: LineChart },
  { id: "studio", label: "AI Studio", icon: Wand2 },
  { id: "plan", label: "Plan", icon: CalendarDays },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("uz-UZ").format(value);
}

function cleanUsername(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//, "")
    .replace(/^@/, "")
    .replace(/\/.*$/, "")
    .trim();
}

function normalizeProfile(profile: Partial<InstagramProfile>): InstagramProfile {
  const username = cleanUsername(profile.username || "");

  return {
    username,
    displayName: profile.displayName || username,
    bio: profile.bio || "",
    avatarUrl: profile.avatarUrl || "",
    followers: Number(profile.followers || 0),
    following: Number(profile.following || 0),
    mediaCount: Number(profile.mediaCount || 0),
    profileUrl: profile.profileUrl || `https://instagram.com/${username}`,
  };
}

function improveScript({
  script,
  hasOwnData,
  inspirationCount,
}: {
  script: string;
  hasOwnData: boolean;
  inspirationCount: number;
}) {
  const clean = script.trim();

  if (!clean) {
    return [
      "Senariy yozing.",
      "",
      "AI javoblari faqat real manbalarga tayanadi:",
      "- Mening profilim: 0 media o'qilgan",
      `- Ilhom profillari: ${inspirationCount} ta profil navbatda`,
      "- Winning patterns: 0 ta pattern",
      "",
      "Profil va ilhom profillari o'qilgandan keyin hook, tempo, CTA va mavzu takliflari real statistikaga asoslanadi.",
    ].join("\n");
  }

  return [
    hasOwnData
      ? "My Profile signal: senariy profilingizdagi eng yaxshi retention va save patternlari bilan solishtiriladi."
      : "My Profile signal: profil ulanmagani uchun shaxsiy statistik signal hali 0.",
    inspirationCount
      ? `Inspiration signal: ${inspirationCount} ta profil tahlil navbatida, top reels patternlari kelganda tavsiya kuchayadi.`
      : "Inspiration signal: ilhom profili qo'shilmagan.",
    "",
    "Senariy bazasi:",
    clean.replace(/\.$/, ""),
    "",
    "AI tavsiya shabloni:",
    "1. Hook birinchi 2 soniyada aniq muammo yoki natija bersin.",
    "2. Asosiy qism 3 blokdan oshmasin.",
    "3. Har 4-5 soniyada vizual yoki matn ritmi almashsin.",
    "4. CTA bitta bo'lsin: izoh, saqlash yoki DM.",
    "",
    "Real profilingiz va ilhom profillari o'qilgandan keyin shu javob umumiy shablon emas, aynan statistik patternlar asosida chiqadi.",
  ].join("\n");
}

export default function ContentAiPage() {
  const [profileModal, setProfileModal] = useState(false);
  const [connectedProfile, setConnectedProfile] =
    useState<InstagramProfile | null>(null);
  const [profileInput, setProfileInput] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileError, setProfileError] = useState("");
  const [inspirationInput, setInspirationInput] = useState("");
  const [inspirationProfiles, setInspirationProfiles] = useState<
    InspirationProfile[]
  >([]);
  const [script, setScript] = useState("");
  const [generated, setGenerated] = useState(() =>
    improveScript({ script: "", hasOwnData: false, inspirationCount: 0 })
  );
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [trainModal, setTrainModal] = useState(false);
  const [trainChallenge, setTrainChallenge] = useState({
    question: "",
    token: "",
  });
  const [trainAnswer, setTrainAnswer] = useState("");
  const [trainError, setTrainError] = useState("");
  const [trainLoading, setTrainLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

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
  const hasPatterns = winningPatterns.length > 0;
  const hasIdeas = contentIdeas.length > 0;
  const hasOwnData = Boolean(connectedProfile && media.length);

  const trainingStats = {
    ownMedia: media.length,
    comments: comments.length,
    inspirationProfiles: inspirationProfiles.length,
    inspirationMedia: inspirationProfiles.reduce(
      (sum, item) => sum + item.mediaRead,
      0
    ),
    patterns: winningPatterns.length,
  };

  const profileStatus = connectedProfile
    ? "Profil ulangan, statistika kutilmoqda"
    : "Profil ulanmagan";

  useEffect(() => {
    const saved = window.localStorage.getItem("flowdesk-content-ai-profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<InstagramProfile>;
        setConnectedProfile(normalizeProfile(parsed));
      } catch {
        window.localStorage.removeItem("flowdesk-content-ai-profile");
      }
    }

    fetch("/api/instagram/status")
      .then((res) => res.json())
      .then(
        (data: {
          connected?: boolean;
          profile?: Partial<InstagramProfile> | null;
        }) => {
          if (!data.connected || !data.profile) return;
          const profile = normalizeProfile(data.profile);
          setConnectedProfile(profile);
          window.localStorage.setItem(
            "flowdesk-content-ai-profile",
            JSON.stringify(profile)
          );
        }
      )
      .catch(() => {
        // Cookie-backed profile is optional until OAuth is configured.
      });

    const savedAnalysis = window.localStorage.getItem(
      "flowdesk-content-ai-analysis"
    );
    if (savedAnalysis) {
      try {
        setAnalysis(JSON.parse(savedAnalysis) as AnalysisResult);
      } catch {
        window.localStorage.removeItem("flowdesk-content-ai-analysis");
      }
    }
  }, []);

  function openProfileModal() {
    setProfileError("");
    setProfileInput(connectedProfile?.username || "");
    setProfileName(connectedProfile?.displayName || "");
    setProfileBio(connectedProfile?.bio || "");
    setProfileAvatar(connectedProfile?.avatarUrl || "");
    setProfileModal(true);
  }

  function connectProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const username = cleanUsername(profileInput);

    if (!username) {
      setProfileError("Instagram username yoki profil linkini kiriting.");
      return;
    }

    const nextProfile = {
      username,
      displayName: profileName.trim() || username,
      bio: profileBio.trim(),
      avatarUrl: profileAvatar.trim(),
      followers: 0,
      following: 0,
      mediaCount: 0,
      profileUrl: `https://instagram.com/${username}`,
    };

    setConnectedProfile(nextProfile);
    window.localStorage.setItem(
      "flowdesk-content-ai-profile",
      JSON.stringify(nextProfile)
    );
    setProfileInput("");
    setProfileName("");
    setProfileBio("");
    setProfileAvatar("");
    setProfileError("");
    setProfileModal(false);
  }

  function disconnectProfile() {
    setConnectedProfile(null);
    window.localStorage.removeItem("flowdesk-content-ai-profile");
    fetch("/api/instagram/disconnect", { method: "POST" }).catch(() => {
      // Local disconnect should still work even if the API is unavailable.
    });
    setProfileModal(false);
  }

  function startInstagramOauth() {
    window.location.href = "/api/instagram/connect";
  }

  function addInspirationProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const username = cleanUsername(inspirationInput);
    if (!username) return;

    setInspirationProfiles((items) => {
      if (
        items.some(
          (item) => item.username.toLowerCase() === username.toLowerCase()
        )
      ) {
        return items;
      }

      return [
        ...items,
        {
          id: `${username}-${Date.now()}`,
          username,
          status: "queued",
          mediaRead: 0,
          topVideos: 0,
          patterns: 0,
        },
      ];
    });
    setInspirationInput("");
  }

  function removeInspirationProfile(id: string) {
    setInspirationProfiles((items) => items.filter((item) => item.id !== id));
  }

  function handleGenerate() {
    setGenerated(
      improveScript({
        script,
        hasOwnData,
        inspirationCount: inspirationProfiles.length,
      })
    );
  }

  async function loadTrainChallenge() {
    const res = await fetch("/api/auth/challenge");
    const data = await res.json();
    setTrainChallenge({
      question: data.question || "",
      token: data.token || "",
    });
    setTrainAnswer("");
    setTrainError("");
  }

  async function openTrainModal() {
    await loadTrainChallenge();
    setTrainModal(true);
  }

  async function runVerifiedAnalysis(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTrainLoading(true);
    setTrainError("");

    const res = await fetch("/api/content-ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        captchaToken: trainChallenge.token,
        captchaAnswer: trainAnswer,
        inspirationProfiles,
        mediaCount: media.length,
        commentsCount: comments.length,
        patternCount: winningPatterns.length,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setTrainError(data.error || "Tahlilni tasdiqlashda xatolik yuz berdi");
      await loadTrainChallenge();
      setTrainLoading(false);
      return;
    }

    const nextAnalysis = data as AnalysisResult;
    setAnalysis(nextAnalysis);
    window.localStorage.setItem(
      "flowdesk-content-ai-analysis",
      JSON.stringify(nextAnalysis)
    );
    setTrainModal(false);
    setTrainLoading(false);
  }

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-accent mb-1.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Real profil va benchmark profillar asosidagi AI content laboratoriya
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Content AI
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            AI avval profilingizni o'qiydi, keyin siz kiritgan ilhom
            profillaridagi eng yaxshi videolardan pattern chiqaradi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={openProfileModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/25"
          >
            {connectedProfile ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            {connectedProfile ? "Profil ulangan" : "Instagram ulash"}
          </button>
          <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-black/[0.07] dark:border-white/[0.09] rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all">
            <RefreshCw className="w-4 h-4 text-[#0a84ff]" />
            Statistika yangilash
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-3xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] p-2 shadow-sm">
        {sections.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                active
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {section.label}
            </button>
          );
        })}
      </div>

      {activeSection === "overview" && (
        <div className="fade-in">
          <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6 mb-6">
            <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
              <InstagramProfileCard
                profile={connectedProfile}
                onConnect={openProfileModal}
              />
            </section>
            <MarketingGrowthPanel
              profile={connectedProfile}
              inspirationCount={inspirationProfiles.length}
              readiness={analysis?.readiness || 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-6 mb-6">
            <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Secure Connect
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Login/parol saqlanmaydi. Ulanish Instagram ruxsatlari orqali qilinadi.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-[#eaf9ef] text-[#22a447] flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 p-4 mb-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Status
            </div>
            <div className="font-display font-extrabold text-slate-900 dark:text-slate-100">
              {profileStatus}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-2">
              Hozir profil username orqali panelga ulanadi. Keyingi backend
              bosqichida shu joy OAuth token olib, real Instagram insightslarni
              avtomatik tortadi.
            </p>
          </div>

          <button
            onClick={openProfileModal}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/20"
          >
            <Camera className="w-4 h-4" />
            {connectedProfile ? "Profil ulanishini boshqarish" : "Profil ulash"}
          </button>
            </section>

            <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                AI data pipeline
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Content AI shu tartibda real profilni o'qib tavsiya beradi.
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-accent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pipeline.map((item, index) => (
              <div
                key={item.title}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4"
              >
                <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-900 text-accent flex items-center justify-center text-sm font-extrabold mb-3">
                  {index + 1}
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
            </section>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
            <Kpi label="Ko'rish" value={formatNumber(totals.views)} icon={Eye} tone="blue" />
            <Kpi label="Reach" value={formatNumber(totals.reach)} icon={Target} tone="purple" />
            <Kpi label="Saqlash" value={formatNumber(totals.saves)} icon={Save} tone="green" />
            <Kpi label="Ulashish" value={formatNumber(totals.shares)} icon={Send} tone="accent" />
            <Kpi label="Komment" value={formatNumber(totals.commentsCount)} icon={MessageCircle} tone="orange" />
            <Kpi label="Retention" value={`${totals.retention}%`} icon={LineChart} tone="blue" />
          </div>
        </div>
      )}

      {activeSection === "profile" && (
        <div className="space-y-6 mb-6 fade-in">
          <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
            <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
              <InstagramProfileCard
                profile={connectedProfile}
                onConnect={openProfileModal}
              />
            </section>
            <ProfileMirrorPanel
              profile={connectedProfile}
              mediaCount={media.length}
              commentsCount={comments.length}
              patternCount={winningPatterns.length}
              onConnect={openProfileModal}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Mening kontentlarim
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Har bir video: view, reach, komment, save, retention va AI score.
              </p>
            </div>
            <BarChart3 className="w-5 h-5 text-accent" />
          </div>

          {hasMedia ? (
            <MediaTable media={media} />
          ) : (
            <EmptyState
              icon={Play}
              title="Hali video statistikasi yo'q"
              text="Instagram profil ulangandan keyin har bir reels va post real raqamlari bilan shu jadvalda chiqadi."
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
                Savol, e'tiroz, xarid signali va yangi video g'oyalari.
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
              text="Profil ulangandan keyin AI kommentlarni guruhlaydi va qaysi savoldan yangi kontent qilish kerakligini chiqaradi."
            />
          )}
        </section>
          </div>
        </div>
      )}

      {activeSection === "inspiration" && (
        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6 mb-6 fade-in">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Ilhom profillari
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                AI benchmark sifatida o'qishi kerak bo'lgan profillar.
              </p>
            </div>
            <Search className="w-5 h-5 text-[#0a84ff]" />
          </div>

          <form onSubmit={addInspirationProfile} className="flex gap-2 mb-4">
            <input
              value={inspirationInput}
              onChange={(e) => setInspirationInput(e.target.value)}
              placeholder="@username yoki instagram.com/username"
              className="min-w-0 flex-1 rounded-full border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
            />
            <button className="w-11 h-11 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {inspirationProfiles.length ? (
            <div className="space-y-3">
              {inspirationProfiles.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                        @{item.username}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {item.status === "queued"
                          ? "Tahlil navbatida"
                          : "Tahlil qilinmoqda"}
                      </div>
                    </div>
                    <button
                      onClick={() => removeInspirationProfile(item.id)}
                      className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <MiniStat label="Media" value={String(item.mediaRead)} />
                    <MiniStat label="Top video" value={String(item.topVideos)} />
                    <MiniStat label="Pattern" value={String(item.patterns)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Link2}
              title="Ilhom profili qo'shilmagan"
              text="Kerakli profillarni kiriting. AI eng yaxshi ko'rilgan videolar, hook, mavzu, caption va komment patternlarini ajratadi."
            />
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Winning Patterns
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Mening profilim + ilhom profillaridan topilgan ishlaydigan formulalar.
              </p>
            </div>
            <Lightbulb className="w-5 h-5 text-[#ff9f0a]" />
          </div>

          {hasPatterns ? (
            <div className="space-y-3">
              {winningPatterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {pattern.title}
                    </div>
                    <span className="text-xs font-bold text-accent">
                      {pattern.confidence}%
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-6">
                    {pattern.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="Patternlar hali topilmagan"
              text="AI real kontent va ilhom profillaridagi yaxshi ketgan videolarni o'qigandan keyin hook, format va CTA patternlarini chiqaradi."
            />
          )}
        </section>
        </div>
      )}

      {activeSection === "studio" && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-6 fade-in">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Script Studio
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                AI javobi real profil va ilhom profillari signaliga tayanadi.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all"
            >
              <Wand2 className="w-4 h-4" />
              Real data bilan tekshirish
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <SourceCard label="My profile" value={`${media.length} media`} />
            <SourceCard
              label="Inspiration"
              value={`${inspirationProfiles.length} profil`}
            />
            <SourceCard label="Patterns" value={`${winningPatterns.length} ta`} />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                AI training holati
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                O'qish uchun kerak bo'ladigan barcha real signal joylari.
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-accent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <TrainingCard icon={Eye} label="Mening media" value={String(trainingStats.ownMedia)} />
            <TrainingCard icon={MessageCircle} label="Komment" value={String(trainingStats.comments)} />
            <TrainingCard icon={UserRound} label="Ilhom profil" value={String(trainingStats.inspirationProfiles)} />
            <TrainingCard icon={Play} label="Ilhom media" value={String(trainingStats.inspirationMedia)} />
            <TrainingCard icon={Heart} label="Engagement signal" value="0" />
            <TrainingCard icon={LineChart} label="Pattern topildi" value={String(trainingStats.patterns)} />
          </div>

          <div className="rounded-2xl bg-[#eef7ff] border border-[#0a84ff]/10 p-4 flex items-start gap-3">
            <ClipboardList className="w-5 h-5 text-[#0a84ff] mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-6">
              Real ulanish bosqichida Instagram Graph API orqali profilingiz
              insights bilan olinadi. Ilhom profillari esa benchmark sifatida
              o'qiladi va AI ko'chirish emas, pattern chiqarish uchun ishlatadi.
            </p>
          </div>
        </section>
        </div>
      )}

      {activeSection === "ml-data" && (
        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 fade-in">
          <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  Content AI Analitika
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  AI o'rganadigan profil, kontent, komment va pattern signallari.
                </p>
              </div>
              <LineChart className="w-5 h-5 text-accent" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <TrainingCard icon={UserRound} label="Profil dataset" value={String(connectedProfile ? 1 : 0)} />
              <TrainingCard icon={Play} label="Media dataset" value={String(media.length)} />
              <TrainingCard icon={MessageCircle} label="Komment dataset" value={String(comments.length)} />
              <TrainingCard icon={Search} label="Benchmark profil" value={String(inspirationProfiles.length)} />
              <TrainingCard icon={Lightbulb} label="Pattern memory" value={String(winningPatterns.length)} />
              <TrainingCard icon={Sparkles} label="AI tavsiya" value={String(contentIdeas.length)} />
            </div>

            <div className="rounded-2xl bg-[#eef7ff] border border-[#0a84ff]/10 p-4 flex items-start gap-3">
              <ClipboardList className="w-5 h-5 text-[#0a84ff] mt-0.5 shrink-0" />
              <p className="text-sm text-slate-600 leading-6">
                Bu bo'lim profil, media, komment, ilhom profillari va AI
                chiqargan patternlardan real analytics snapshot yaratadi.
                Snapshot verificationdan keyin yangilanadi va keyingi kirishda
                xotirada qoladi.
              </p>
            </div>

            {analysis && (
              <div className="mt-4 rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Oxirgi verified tahlil
                    </div>
                    <div className="font-display font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                      Readiness {analysis.readiness}%
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(analysis.analyzedAt).toLocaleString("uz-UZ")}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-3">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${analysis.readiness}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <MiniStat
                    label="Signal"
                    value={String(analysis.summary.signalCount)}
                  />
                  <MiniStat
                    label="Benchmark"
                    value={String(analysis.summary.inspirationProfiles)}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                  Training pipeline
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Profil tahlili AI qaysi tartibda o'rganishini boshqarish.
                </p>
              </div>
              <button
                onClick={openTrainModal}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Verified tahlil
              </button>
            </div>

            {analysis ? (
              <div className="space-y-3 mb-4">
                {analysis.recommendations.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#22a447] mt-0.5 shrink-0" />
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-6">
                        {item}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.12] bg-slate-50/70 dark:bg-slate-950 p-5 mb-4">
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  Verified analytics hali yo'q
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1">
                  Tahlilni boshlashdan oldin verificationdan o'ting. Shundan
                  keyin Content AI signal snapshot va tavsiyalarni saqlaydi.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {[
                {
                  title: "1. Profil snapshot",
                  text: "Bio, follower, following, media count va profil identifikatori saqlanadi.",
                },
                {
                  title: "2. Media scoring",
                  text: "Har reels/post view, reach, save, share, comment va retention bo'yicha baholanadi.",
                },
                {
                  title: "3. Benchmark learning",
                  text: "Belgilangan ilhom profillaridagi yaxshi uchgan kontent patternlari ajratiladi.",
                },
                {
                  title: "4. Recommendation memory",
                  text: "AI bergan maslahatlar va keyingi natijalar bog'lanib, xotira kuchayadi.",
                },
              ].map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4"
                >
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {step.title}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeSection === "plan" && (
        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6 fade-in">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                AI Ideas
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Real patternlardan yangi reels g'oyalari chiqadi.
              </p>
            </div>
            <Lightbulb className="w-5 h-5 text-[#ff9f0a]" />
          </div>

          {hasIdeas ? (
            <div className="space-y-3">
              {contentIdeas.map((idea) => (
                <div
                  key={idea.id}
                  className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] p-4"
                >
                  <div className="font-bold text-slate-900 dark:text-slate-100">
                    {idea.title}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {idea.source} · {idea.score} score
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Lightbulb}
              title="AI g'oyalar hali yo'q"
              text="Profil va ilhom profillari o'qilgandan keyin AI sizning auditoriyangizga mos g'oyalar beradi."
            />
          )}
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Content Plan
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Reja faqat real statistik patternlar o'qilgandan keyin tuziladi.
              </p>
            </div>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 border border-black/[0.07] dark:border-white/[0.09] text-slate-700 dark:text-slate-200 rounded-full text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-[0.97] transition-all">
              <CalendarDays className="w-4 h-4 text-[#34c759]" />
              Reja tuzish
            </button>
          </div>

          {contentPlan.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              text="AI profilingiz va benchmark profillardan pattern o'qigandan keyin 7/14/30 kunlik reja beradi."
            />
          )}
        </section>
        </div>
      )}

      <Modal
        open={trainModal}
        onClose={() => setTrainModal(false)}
        title="ML tahlilni tasdiqlash"
      >
        <form onSubmit={runVerifiedAnalysis} className="space-y-4">
          <div className="rounded-2xl bg-[#fff4d8] border border-[#ff9f0a]/15 p-4">
            <p className="text-sm text-slate-600 leading-6">
              Bu amal Content AI xotirasini yangilaydi. Tahlil verified bo'lishi
              uchun robot emasligingizni tasdiqlang.
            </p>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verification
            </label>
            <div className="flex items-center gap-2 mt-2">
              <div className="px-4 py-3 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-28 text-center">
                {trainChallenge.question || "..."}
              </div>
              <input
                value={trainAnswer}
                onChange={(e) => {
                  setTrainAnswer(e.target.value);
                  setTrainError("");
                }}
                inputMode="numeric"
                placeholder="Javob"
                required
                className="min-w-0 flex-1 rounded-full border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
              />
              <button
                type="button"
                onClick={loadTrainChallenge}
                className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-accent transition-colors flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {trainError && (
              <div className="text-sm text-red-500 mt-2">{trainError}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Profil" value={connectedProfile ? "1" : "0"} />
            <MiniStat
              label="Benchmark"
              value={String(inspirationProfiles.length)}
            />
            <MiniStat label="Media" value={String(media.length)} />
            <MiniStat label="Komment" value={String(comments.length)} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setTrainModal(false)}
              className="px-4 py-2.5 rounded-full bg-white dark:bg-slate-950 border border-black/[0.07] dark:border-white/[0.09] text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Bekor qilish
            </button>
            <button
              disabled={trainLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              {trainLoading ? "Tahlil qilinmoqda..." : "Tasdiqlab tahlil qilish"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={profileModal}
        onClose={() => setProfileModal(false)}
        title="Secure Instagram ulash"
      >
        <form onSubmit={connectProfile} className="space-y-4">
          <div className="rounded-2xl bg-[#eaf9ef] border border-[#34c759]/15 p-4 flex gap-3">
            <Lock className="w-5 h-5 text-[#22a447] mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600 leading-6">
              Instagram parolingiz bu appga kiritilmaydi va saqlanmaydi. Real
              statistika uchun keyin OAuth permission yoki access token backend
              orqali ulanadi.
            </p>
          </div>

          <button
            type="button"
            onClick={startInstagramOauth}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/20"
          >
            <Camera className="w-4 h-4" />
            Instagram orqali tasdiqlash
          </button>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Manual preview uchun username yoki link
            </label>
            <input
              value={profileInput}
              onChange={(e) => {
                setProfileInput(e.target.value);
                setProfileError("");
              }}
              placeholder="@username yoki instagram.com/username"
              className="mt-2 w-full rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
              autoFocus
            />
            {profileError && (
              <div className="text-sm text-red-500 mt-2">{profileError}</div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Profil nomi
              </label>
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Masalan: FlowDesk"
                className="mt-2 w-full rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Avatar URL
              </label>
              <input
                value={profileAvatar}
                onChange={(e) => setProfileAvatar(e.target.value)}
                placeholder="https://..."
                className="mt-2 w-full rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Bio
            </label>
            <textarea
              value={profileBio}
              onChange={(e) => setProfileBio(e.target.value)}
              placeholder="Instagram bio matni..."
              className="mt-2 w-full min-h-24 resize-none rounded-2xl border border-black/[0.07] dark:border-white/[0.09] bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent"
            />
          </div>

          <div className="rounded-2xl bg-[#eef7ff] border border-[#0a84ff]/10 p-4">
            <p className="text-sm text-slate-600 leading-6">
              Yuqoridagi tugma Instagram'ga request yuboradi. Agar Meta app
              env sozlanmagan bo'lsa, pastdagi manual preview orqali profil
              ko'rinishini vaqtincha ulab turishingiz mumkin.
            </p>
          </div>

          <div className="flex flex-wrap justify-between gap-2 pt-2">
            {connectedProfile ? (
              <button
                type="button"
                onClick={disconnectProfile}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Uzish
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setProfileModal(false)}
                className="px-4 py-2.5 rounded-full bg-white dark:bg-slate-950 border border-black/[0.07] dark:border-white/[0.09] text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Bekor qilish
              </button>
              <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all">
                <CheckCircle2 className="w-4 h-4" />
                Profilni ulash
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function InstagramProfileCard({
  profile,
  onConnect,
}: {
  profile: InstagramProfile | null;
  onConnect: () => void;
}) {
  if (!profile) {
    return (
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
            <UserRound className="w-10 h-10" />
          </div>
          <div>
            <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100">
              Instagram profil ulanmagan
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1 max-w-xl">
              Profilni ulaganingizdan keyin u shu yerda Instagram ko'rinishiga
              yaqin tarzda chiqadi: avatar, username, bio, post, follower va
              following.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {[
                "My Profile",
                "Reels",
                "Kommentlar",
                "Inspiration",
                "AI training",
              ].map((item) => (
                <span
                  key={item}
                  className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-500 dark:text-slate-400"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onConnect}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-hover active:scale-[0.97] transition-all shadow-lg shadow-accent/20"
        >
          <Camera className="w-4 h-4" />
          Profil ulash
        </button>
      </div>
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
        <div className="flex items-start gap-5">
          <div className="w-24 h-24 rounded-full p-0.5 bg-gradient-to-br from-[#ff2d5d] via-[#ff9f0a] to-[#8f35d5] shrink-0">
            <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 p-1">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={displayName}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                  <UserRound className="w-10 h-10" />
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100">
                @{profile.username}
              </h2>
              <span className="px-2.5 py-1 rounded-full bg-[#eaf9ef] text-[#22a447] text-xs font-bold">
                Ulangan
              </span>
            </div>
            <div className="font-semibold text-slate-900 dark:text-slate-100 mt-2">
              {displayName}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1 whitespace-pre-wrap">
              {profile.bio ||
                "Bio hozircha kiritilmagan. Real API ulanganda Instagram bio avtomatik keladi."}
            </p>
            <div className="flex flex-wrap gap-5 mt-4 text-sm">
              <ProfileCount label="post" value={profile.mediaCount} />
              <ProfileCount label="followers" value={profile.followers} />
              <ProfileCount label="following" value={profile.following} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onConnect}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Tahrirlash
          </button>
          <a
            href={profile.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
          >
            <Link2 className="w-4 h-4" />
            Instagramda ochish
          </a>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {["Reels", "Postlar", "Kommentlar"].map((item) => (
          <div
            key={item}
            className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.06] dark:border-white/[0.08] p-4 text-center"
          >
            <div className="text-xl font-display font-extrabold text-slate-900 dark:text-slate-100">
              0
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mt-1">
              {item}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketingGrowthPanel({
  profile,
  inspirationCount,
  readiness,
}: {
  profile: InstagramProfile | null;
  inspirationCount: number;
  readiness: number;
}) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Profil Growth Cockpit
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Profil marketingi, kontent pillar va reels growth qarorlari shu
            joyda AI tomonidan boshqariladi.
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-accent-soft text-accent flex items-center justify-center">
          <Zap className="w-5 h-5" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <MiniStat label="Profil" value={profile ? "1" : "0"} />
        <MiniStat label="Benchmark" value={String(inspirationCount)} />
        <MiniStat label="Readiness" value={`${readiness}%`} />
      </div>

      <div className="space-y-3 mb-5">
        {growthFocus.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {item.title}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1">
                  {item.text}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-slate-400 border border-black/[0.06] dark:border-white/[0.08]">
                {item.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {marketingActions.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft/70 px-3 py-1.5 text-xs font-bold text-accent-ink dark:text-slate-100"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function ProfileMirrorPanel({
  profile,
  mediaCount,
  commentsCount,
  patternCount,
  onConnect,
}: {
  profile: InstagramProfile | null;
  mediaCount: number;
  commentsCount: number;
  patternCount: number;
  onConnect: () => void;
}) {
  return (
    <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
            Instagram profil ko'rinishi
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Profil shu sahifada klon ko'rinishida turadi, AI esa shu profilni
            rivojlantirish uchun kontent va marketing qarorlarini chiqaradi.
          </p>
        </div>
        <button
          onClick={onConnect}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
        >
          <Camera className="w-4 h-4" />
          {profile ? "Profilni yangilash" : "Profil ulash"}
        </button>
      </div>

      <div className="rounded-[28px] border border-black/[0.08] dark:border-white/[0.1] bg-slate-50 dark:bg-slate-950 p-4">
        <div className="rounded-[24px] bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
          <div className="h-12 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between px-4">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              {profile ? profile.username : "instagram"}
            </div>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full p-0.5 bg-gradient-to-br from-[#ff2d5d] via-[#ff9f0a] to-[#8f35d5] shrink-0">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 p-1">
                  {profile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt={profile.displayName || profile.username}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                      <UserRound className="w-8 h-8" />
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 flex-1 text-center">
                <ProfileCount label="post" value={profile?.mediaCount || 0} />
                <ProfileCount label="followers" value={profile?.followers || 0} />
                <ProfileCount label="following" value={profile?.following || 0} />
              </div>
            </div>
            <div className="mt-4">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {profile?.displayName || "Profil nomi"}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1 whitespace-pre-wrap">
                {profile?.bio ||
                  "Bio, avatar va statistikalar profil ulangandan keyin shu yerda chiqadi."}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1 mt-4">
              {Array.from({ length: 9 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600"
                >
                  <Play className="w-4 h-4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <MiniStat label="Media o'qildi" value={String(mediaCount)} />
        <MiniStat label="Komment" value={String(commentsCount)} />
        <MiniStat label="Pattern" value={String(patternCount)} />
      </div>
    </section>
  );
}

function ProfileCount({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span className="font-display font-extrabold text-slate-900 dark:text-slate-100">
        {formatNumber(value)}
      </span>{" "}
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}

function MediaTable({ media }: { media: InstagramMedia[] }) {
  return (
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
              <td className="py-3 pl-4 font-bold text-accent">{item.aiScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-950 px-3 py-2">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="font-display font-extrabold text-slate-900 dark:text-slate-100">
        {value}
      </div>
    </div>
  );
}

function SourceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="font-display font-extrabold text-slate-900 dark:text-slate-100 mt-1">
        {value}
      </div>
    </div>
  );
}
