"use client";

import { useEffect, useState, useMemo } from "react";
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  Globe,
  Bot,
  ExternalLink,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Award,
  DollarSign,
  Calendar,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Edit2,
  ArrowRight,
  TrendingUp,
  BookmarkCheck,
  Share2,
  Key,
  Mail,
  UserCheck,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type University = {
  id: number;
  name: string;
  country: string;
  city: string | null;
  major: string;
  degree: string | null;
  tuitionFee: string | null;
  hasGrant: boolean | null;
  grantDetails: string | null;
  requirements: string | null;
  deadline: string | null;
  admissionStatus: string;
  ranking: string | null;
  websiteUrl: string | null;
  notes: string | null;
  createdAt: string;
};

type StudyRoadmap = {
  id: number;
  title: string;
  category: string;
  priority: string | null;
  status: string;
  progress: number | null;
  targetDate: string | null;
  resources: string | null;
  notes: string | null;
};

type AiNewsItem = {
  id: number;
  newsDate: string;
  title: string;
  summary: string;
  keyTakeaway: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  category: string | null;
  createdAt: string;
};

const GOOGLE_PRODUCTS = [
  {
    name: "Google Gemini",
    desc: "Eng so'nggi multimodal AI suhbatdosh va kod/tahlil yordamchisi",
    url: "https://gemini.google.com/app",
    icon: Sparkles,
    gradient: "from-blue-500 to-indigo-600",
    badge: "AI Yordamchi",
  },
  {
    name: "Google AI Studio",
    desc: "Gemini 2.5 va 2.0 Flash modellari bilan bepul prompt sinash va API kalitlar",
    url: "https://aistudio.google.com",
    icon: Bot,
    gradient: "from-indigo-600 to-purple-600",
    badge: "Dasturchilar uchun",
  },
  {
    name: "Google Scholar",
    desc: "Dunyo bo'yicha ilmiy maqolalar, dissertatsiyalar va tadqiqotlar bazasi",
    url: "https://scholar.google.com",
    icon: GraduationCap,
    gradient: "from-cyan-600 to-blue-700",
    badge: "Ilmiy Tahlil",
  },
  {
    name: "Google Drive & Docs",
    desc: "Shaxsiy o'quv konspektlari, reja fayllari va hujjatlar buluti",
    url: "https://drive.google.com",
    icon: Globe,
    gradient: "from-amber-500 to-orange-600",
    badge: "Hujjatlar",
  },
  {
    name: "Google Classroom",
    desc: "Onlayn kurslar, topshiriqlar va o'quv guruhlari platformasi",
    url: "https://classroom.google.com",
    icon: BookOpen,
    gradient: "from-emerald-500 to-teal-700",
    badge: "Ta'lim",
  },
  {
    name: "Google Sheets",
    desc: "Moliyaviy hisob-kitoblar, universitetlar jadvali va data tahlil",
    url: "https://sheets.google.com",
    icon: TrendingUp,
    gradient: "from-green-600 to-emerald-700",
    badge: "Jadvallar",
  },
];

const ADMISSION_STATUSES: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  rejalashtirilgan: {
    label: "Rejalashtirilgan",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
  },
  hujjat_topshirildi: {
    label: "Hujjat topshirildi",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
  },
  qabul_qilindi: {
    label: "Qabul qilindi! 🎉",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
  },
  rad_etildi: {
    label: "Rad etildi",
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
    border: "border-rose-500/20",
  },
};

export default function EducationPage() {
  const [activeTab, setActiveTab] = useState<"universities" | "roadmap" | "ai_news" | "google">("universities");

  // Universities state
  const [universitiesList, setUniversitiesList] = useState<University[]>([]);
  const [loadingUnis, setLoadingUnis] = useState(true);
  const [uniSearch, setUniSearch] = useState("");
  const [uniRegionFilter, setUniRegionFilter] = useState<"all" | "uzbekistan" | "international">("all");
  const [uniStatusFilter, setUniStatusFilter] = useState<string>("all");
  const [uniModalOpen, setUniModalOpen] = useState(false);
  const [editingUni, setEditingUni] = useState<University | null>(null);

  // Roadmaps state
  const [roadmaps, setRoadmaps] = useState<StudyRoadmap[]>([]);
  const [loadingRoadmaps, setLoadingRoadmaps] = useState(true);
  const [roadmapModalOpen, setRoadmapModalOpen] = useState(false);
  const [editingRoadmap, setEditingRoadmap] = useState<StudyRoadmap | null>(null);

  // AI News state
  const [aiNews, setAiNews] = useState<AiNewsItem[]>([]);
  const [loadingAiNews, setLoadingAiNews] = useState(true);
  const [refreshingNews, setRefreshingNews] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Google & Settings state
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // University Form State
  const [uniForm, setUniForm] = useState({
    name: "",
    country: "O'zbekiston",
    city: "",
    major: "",
    degree: "Bakalavr",
    tuitionFee: "",
    hasGrant: false,
    grantDetails: "",
    requirements: "",
    deadline: "",
    admissionStatus: "rejalashtirilgan",
    ranking: "",
    websiteUrl: "",
    notes: "",
  });

  // Roadmap Form State
  const [roadmapForm, setRoadmapForm] = useState({
    title: "",
    category: "Dasturlash",
    priority: "high",
    status: "in_progress",
    progress: 50,
    targetDate: "",
    resources: "",
    notes: "",
  });

  // Fetch initial data
  useEffect(() => {
    fetchUniversities();
    fetchRoadmaps();
    fetchAiNews();
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data) {
        if (data.google_account_email) setGoogleEmail(data.google_account_email);
        if (data.google_account_name) setGoogleName(data.google_account_name);
        if (data.gemini_api_key) setGeminiApiKey(data.gemini_api_key);
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function saveGoogleSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "google_account_email", value: googleEmail }),
      });
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "google_account_name", value: googleName }),
      });
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "gemini_api_key", value: geminiApiKey }),
      });
      setSettingsSavedSuccess(true);
      setTimeout(() => setSettingsSavedSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert("Sozlamalarni saqlashda xatolik yuz berdi");
    } finally {
      setSavingSettings(false);
    }
  }

  async function fetchUniversities() {
    setLoadingUnis(true);
    try {
      const res = await fetch("/api/education/universities");
      const data = await res.json();
      if (data.success) {
        setUniversitiesList(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUnis(false);
    }
  }

  async function fetchRoadmaps() {
    setLoadingRoadmaps(true);
    try {
      const res = await fetch("/api/education/roadmaps");
      const data = await res.json();
      if (data.success) {
        setRoadmaps(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRoadmaps(false);
    }
  }

  async function fetchAiNews(forceRefresh = false) {
    if (forceRefresh) setRefreshingNews(true);
    else setLoadingAiNews(true);
    try {
      const url = forceRefresh
        ? "/api/education/ai-news?refresh=true"
        : "/api/education/ai-news";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setAiNews(data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAiNews(false);
      setRefreshingNews(false);
    }
  }

  // University CRUD
  async function handleSaveUniversity(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUni) {
        const res = await fetch("/api/education/universities", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingUni.id, ...uniForm }),
        });
        const data = await res.json();
        if (data.success) {
          setUniversitiesList((prev) =>
            prev.map((u) => (u.id === editingUni.id ? data.data : u))
          );
        }
      } else {
        const res = await fetch("/api/education/universities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(uniForm),
        });
        const data = await res.json();
        if (data.success) {
          setUniversitiesList((prev) => [data.data, ...prev]);
        }
      }
      setUniModalOpen(false);
      setEditingUni(null);
    } catch (e) {
      console.error(e);
      alert("Saqlashda xatolik");
    }
  }

  async function handleDeleteUniversity(id: number) {
    if (!confirm("Universitetni ro'yxatdan o'chirishga ishonchingiz komilmi?")) return;
    try {
      const res = await fetch(`/api/education/universities?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setUniversitiesList((prev) => prev.filter((u) => u.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function updateUniStatus(id: number, status: string) {
    try {
      const res = await fetch("/api/education/universities", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, admissionStatus: status }),
      });
      const data = await res.json();
      if (data.success) {
        setUniversitiesList((prev) =>
          prev.map((u) => (u.id === id ? { ...u, admissionStatus: status } : u))
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Roadmap CRUD
  async function handleSaveRoadmap(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingRoadmap) {
        const res = await fetch("/api/education/roadmaps", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingRoadmap.id, ...roadmapForm }),
        });
        const data = await res.json();
        if (data.success) {
          setRoadmaps((prev) =>
            prev.map((r) => (r.id === editingRoadmap.id ? data.data : r))
          );
        }
      } else {
        const res = await fetch("/api/education/roadmaps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roadmapForm),
        });
        const data = await res.json();
        if (data.success) {
          setRoadmaps((prev) => [data.data, ...prev]);
        }
      }
      setRoadmapModalOpen(false);
      setEditingRoadmap(null);
    } catch (e) {
      console.error(e);
      alert("Saqlashda xatolik");
    }
  }

  async function handleDeleteRoadmap(id: number) {
    if (!confirm("Rejani o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/education/roadmaps?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRoadmaps((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function quickUpdateProgress(id: number, delta: number) {
    const item = roadmaps.find((r) => r.id === id);
    if (!item) return;
    const newProgress = Math.min(100, Math.max(0, (item.progress || 0) + delta));
    const newStatus = newProgress === 100 ? "completed" : "in_progress";

    try {
      await fetch("/api/education/roadmaps", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, progress: newProgress, status: newStatus }),
      });
      setRoadmaps((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, progress: newProgress, status: newStatus } : r
        )
      );
    } catch (e) {
      console.error(e);
    }
  }

  function copyNewsText(item: AiNewsItem) {
    const text = `🤖 ${item.title}\n\n📌 ${item.summary}\n\n💡 Xulosa: ${item.keyTakeaway || ""}\n🔗 Manba: ${item.sourceUrl || ""}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filtered universities
  const filteredUnis = useMemo(() => {
    return universitiesList.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(uniSearch.toLowerCase()) ||
        u.major.toLowerCase().includes(uniSearch.toLowerCase()) ||
        (u.city && u.city.toLowerCase().includes(uniSearch.toLowerCase())) ||
        (u.country && u.country.toLowerCase().includes(uniSearch.toLowerCase()));

      let matchesRegion = true;
      if (uniRegionFilter === "uzbekistan") {
        matchesRegion = u.country.toLowerCase().includes("o'zbekiston");
      } else if (uniRegionFilter === "international") {
        matchesRegion = !u.country.toLowerCase().includes("o'zbekiston");
      }

      const matchesStatus =
        uniStatusFilter === "all" || u.admissionStatus === uniStatusFilter;

      return matchesSearch && matchesRegion && matchesStatus;
    });
  }, [universitiesList, uniSearch, uniRegionFilter, uniStatusFilter]);

  // Uni stats
  const uniStats = useMemo(() => {
    const total = universitiesList.length;
    const withGrants = universitiesList.filter((u) => u.hasGrant).length;
    const accepted = universitiesList.filter((u) => u.admissionStatus === "qabul_qilindi").length;
    const inProgress = universitiesList.filter(
      (u) => u.admissionStatus === "hujjat_topshirildi" || u.admissionStatus === "rejalashtirilgan"
    ).length;
    return { total, withGrants, accepted, inProgress };
  }, [universitiesList]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                O&apos;qish & Tahlil Markazi
              </h1>
              <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400">
                Universitetlar tahlili, o&apos;rganish rejalari, kunlik 5 ta AI yangilik va Google ekotizimi
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl border border-black/[0.05] dark:border-white/[0.05]">
          <button
            onClick={() => setActiveTab("universities")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "universities"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-blue-500" />
            Universitetlar ({universitiesList.length})
          </button>
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "roadmap"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <BookmarkCheck className="w-4 h-4 text-emerald-500" />
            O&apos;rganish Rejalari ({roadmaps.length})
          </button>
          <button
            onClick={() => setActiveTab("ai_news")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "ai_news"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-500 animate-pulse" />
            Kunlik 5 ta AI Yangilik
          </button>
          <button
            onClick={() => setActiveTab("google")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "google"
                ? "bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            }`}
          >
            <Globe className="w-4 h-4 text-sky-500" />
            Google Ekotizimi
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: UNIVERSITETLAR TAHLILI                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "universities" && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
              <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Jami OTMlar</span>
              <div className="text-2xl font-bold mt-1 text-neutral-900 dark:text-white">{uniStats.total} ta</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Grantli OTMlar
              </span>
              <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{uniStats.withGrants} ta</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Jarayonda / Rejada
              </span>
              <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{uniStats.inProgress} ta</div>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Qabul qilingan
              </span>
              <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">{uniStats.accepted} ta</div>
            </div>
          </div>

          {/* Action & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="OTM, yo'nalish yoki shahar..."
                  value={uniSearch}
                  onChange={(e) => setUniSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Region Filter */}
              <div className="flex items-center p-1 bg-black/[0.04] dark:bg-white/[0.06] rounded-xl text-xs">
                <button
                  onClick={() => setUniRegionFilter("all")}
                  className={`px-2.5 py-1 rounded-lg ${
                    uniRegionFilter === "all" ? "bg-white dark:bg-neutral-800 font-semibold shadow-xs" : "text-neutral-500"
                  }`}
                >
                  Barchasi
                </button>
                <button
                  onClick={() => setUniRegionFilter("uzbekistan")}
                  className={`px-2.5 py-1 rounded-lg ${
                    uniRegionFilter === "uzbekistan" ? "bg-white dark:bg-neutral-800 font-semibold shadow-xs" : "text-neutral-500"
                  }`}
                >
                  O&apos;zbekiston
                </button>
                <button
                  onClick={() => setUniRegionFilter("international")}
                  className={`px-2.5 py-1 rounded-lg ${
                    uniRegionFilter === "international" ? "bg-white dark:bg-neutral-800 font-semibold shadow-xs" : "text-neutral-500"
                  }`}
                >
                  Xalqaro
                </button>
              </div>

              {/* Status Filter */}
              <select
                value={uniStatusFilter}
                onChange={(e) => setUniStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-neutral-900 border border-black/[0.08] dark:border-white/[0.08] text-neutral-700 dark:text-neutral-300"
              >
                <option value="all">Barcha statuslar</option>
                <option value="rejalashtirilgan">Rejalashtirilgan</option>
                <option value="hujjat_topshirildi">Hujjat topshirildi</option>
                <option value="qabul_qilindi">Qabul qilindi</option>
                <option value="rad_etildi">Rad etildi</option>
              </select>
            </div>

            <button
              onClick={() => {
                setEditingUni(null);
                setUniForm({
                  name: "",
                  country: "O'zbekiston",
                  city: "",
                  major: "",
                  degree: "Bakalavr",
                  tuitionFee: "",
                  hasGrant: false,
                  grantDetails: "",
                  requirements: "",
                  deadline: "",
                  admissionStatus: "rejalashtirilgan",
                  ranking: "",
                  websiteUrl: "",
                  notes: "",
                });
                setUniModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> Universitet qo&apos;shish
            </button>
          </div>

          {/* Universities List Grid */}
          {loadingUnis ? (
            <div className="py-16 text-center text-neutral-400 text-sm animate-pulse">
              Universitetlar tahlili yuklanmoqda...
            </div>
          ) : filteredUnis.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.1]">
              <GraduationCap className="w-10 h-10 mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
              <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                Hech qanday universitet topilmadi
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                Yangi universitet qo&apos;shing yoki filtrlarni tozalang
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUnis.map((uni) => {
                const statusMeta =
                  ADMISSION_STATUSES[uni.admissionStatus] ||
                  ADMISSION_STATUSES.rejalashtirilgan;

                return (
                  <div
                    key={uni.id}
                    className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {uni.country} {uni.city ? `• ${uni.city}` : ""}
                            </span>
                            {uni.degree && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                                {uni.degree}
                              </span>
                            )}
                            {uni.ranking && (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                ⭐ {uni.ranking}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-2 leading-tight">
                            {uni.name}
                          </h3>
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                            📚 {uni.major}
                          </p>
                        </div>

                        {/* Status badge */}
                        <div className="shrink-0">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusMeta.bg} ${statusMeta.text} ${statusMeta.border}`}
                          >
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      {/* Details & Specs */}
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/[0.04] dark:border-white/[0.04]">
                          <span className="text-[10px] text-neutral-400 block font-medium">Kontrakt / To&apos;lov</span>
                          <span className="font-semibold text-neutral-800 dark:text-neutral-200 mt-0.5 block truncate">
                            {uni.tuitionFee || "Ko'rsatilmagan"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-black/[0.04] dark:border-white/[0.04]">
                          <span className="text-[10px] text-neutral-400 block font-medium">Grant & Stipendiya</span>
                          <span
                            className={`font-semibold mt-0.5 block truncate ${
                              uni.hasGrant ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-500"
                            }`}
                          >
                            {uni.hasGrant ? "Mavjud (Grant bor)" : "To'lovli"}
                          </span>
                        </div>
                      </div>

                      {/* Requirements & Deadline */}
                      {uni.requirements && (
                        <div className="mt-2.5 text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            Qabul Talablari
                          </span>
                          {uni.requirements}
                        </div>
                      )}

                      {uni.notes && (
                        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 italic">
                          &ldquo;{uni.notes}&rdquo;
                        </p>
                      )}

                      {uni.deadline && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                          <Calendar className="w-3.5 h-3.5" /> Oxirgi muddat: {uni.deadline}
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                      {/* Status changer dropdown */}
                      <select
                        value={uni.admissionStatus}
                        onChange={(e) => updateUniStatus(uni.id, e.target.value)}
                        className="text-xs py-1 px-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 border-none text-neutral-700 dark:text-neutral-300 font-medium"
                      >
                        <option value="rejalashtirilgan">Rejada</option>
                        <option value="hujjat_topshirildi">Topshirildi</option>
                        <option value="qabul_qilindi">Qabul qilindi</option>
                        <option value="rad_etildi">Rad etildi</option>
                      </select>

                      <div className="flex items-center gap-1">
                        {uni.websiteUrl && (
                          <a
                            href={uni.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                            title="Rasmiy vebsayt"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => {
                            setEditingUni(uni);
                            setUniForm({
                              name: uni.name,
                              country: uni.country,
                              city: uni.city || "",
                              major: uni.major,
                              degree: uni.degree || "Bakalavr",
                              tuitionFee: uni.tuitionFee || "",
                              hasGrant: !!uni.hasGrant,
                              grantDetails: uni.grantDetails || "",
                              requirements: uni.requirements || "",
                              deadline: uni.deadline || "",
                              admissionStatus: uni.admissionStatus,
                              ranking: uni.ranking || "",
                              websiteUrl: uni.websiteUrl || "",
                              notes: uni.notes || "",
                            });
                            setUniModalOpen(true);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-white rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteUniversity(uni.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: O'RGANISH REJALARI & KO'NIKMALAR (ROADMAP)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "roadmap" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
                O&apos;rganish Rejalari & Ko&apos;nikmalar
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Kelgusi oylarda o&apos;zlashtirilishi kerak bo&apos;lgan fanlar, dasturlash va til ko&apos;nikmalari
              </p>
            </div>
            <button
              onClick={() => {
                setEditingRoadmap(null);
                setRoadmapForm({
                  title: "",
                  category: "Dasturlash",
                  priority: "high",
                  status: "in_progress",
                  progress: 25,
                  targetDate: "",
                  resources: "",
                  notes: "",
                });
                setRoadmapModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all"
            >
              <Plus className="w-4 h-4" /> Yangi Ko&apos;nikma / Reja qo&apos;shish
            </button>
          </div>

          {loadingRoadmaps ? (
            <div className="py-16 text-center text-neutral-400 text-sm animate-pulse">
              Rejalar yuklanmoqda...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roadmaps.map((r) => {
                const prog = r.progress || 0;
                return (
                  <div
                    key={r.id}
                    className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          {r.category}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            r.priority === "high"
                              ? "bg-rose-500/10 text-rose-600"
                              : r.priority === "medium"
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-blue-500/10 text-blue-600"
                          }`}
                        >
                          {r.priority === "high" ? "Muhim / Yuqori" : r.priority === "medium" ? "O'rta" : "Past"}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-2">
                        {r.title}
                      </h3>

                      {r.notes && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          {r.notes}
                        </p>
                      )}

                      {/* Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                          <span className="text-neutral-500 dark:text-neutral-400">O&apos;zlashtirish</span>
                          <span className="font-bold text-neutral-900 dark:text-white">{prog}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 rounded-full ${
                              prog >= 100
                                ? "bg-emerald-500"
                                : prog >= 60
                                ? "bg-blue-500"
                                : prog >= 30
                                ? "bg-amber-500"
                                : "bg-purple-500"
                            }`}
                            style={{ width: `${prog}%` }}
                          />
                        </div>
                      </div>

                      {/* Resources */}
                      {r.resources && (
                        <div className="mt-3 text-xs bg-neutral-50 dark:bg-neutral-800/40 p-2.5 rounded-xl border border-black/[0.04] dark:border-white/[0.04]">
                          <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-0.5">
                            O&apos;quv materiallari & Linklar
                          </span>
                          <span className="text-neutral-700 dark:text-neutral-300 break-words">
                            {r.resources}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Progress shortcuts & actions */}
                    <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => quickUpdateProgress(r.id, 10)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                          title="10% qo'shish"
                        >
                          +10%
                        </button>
                        <button
                          onClick={() => quickUpdateProgress(r.id, 25)}
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                          title="25% qo'shish"
                        >
                          +25%
                        </button>
                        {prog < 100 && (
                          <button
                            onClick={() => quickUpdateProgress(r.id, 100 - prog)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                          >
                            ✓ Tamomlash
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingRoadmap(r);
                            setRoadmapForm({
                              title: r.title,
                              category: r.category,
                              priority: r.priority || "high",
                              status: r.status,
                              progress: r.progress || 0,
                              targetDate: r.targetDate || "",
                              resources: r.resources || "",
                              notes: r.notes || "",
                            });
                            setRoadmapModalOpen(true);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:hover:text-white rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoadmap(r.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: KUNLIK 5 TA AI YANGILIK (DAILY AI NEWS DIGEST)          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "ai_news" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400 animate-spin" style={{ animationDuration: "8s" }} />
                <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                  Bugungi 5 ta Eng Muhim AI Yangiligi
                </h2>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                Google Gemini sun&apos;iy intellekti orqali real vaqtda saralangan va o&apos;zbek tiliga moslashtirilgan tahlillar
              </p>
            </div>

            <button
              onClick={() => fetchAiNews(true)}
              disabled={refreshingNews}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-purple-500/20 transition-all shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingNews ? "animate-spin" : ""}`} />
              {refreshingNews ? "Gemini tahlil qilmoqda..." : "Yangi 5 ta yangilik olish"}
            </button>
          </div>

          {loadingAiNews ? (
            <div className="py-20 text-center text-neutral-400 text-sm animate-pulse">
              Bugungi AI yangiliklari tahlil qilinmoqda...
            </div>
          ) : aiNews.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.1]">
              <Sparkles className="w-10 h-10 mx-auto text-purple-400 mb-2" />
              <p className="text-sm font-medium">Hozircha yangiliklar topilmadi</p>
              <button
                onClick={() => fetchAiNews(true)}
                className="mt-3 px-4 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold"
              >
                Yangiliklarni yaratish
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {aiNews.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow-md transition-all relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold flex items-center justify-center text-sm shrink-0 border border-purple-500/20">
                        #{idx + 1}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {item.category || "AI & Tech"}
                          </span>
                          {item.sourceName && (
                            <span className="text-[11px] text-neutral-400">
                              Manba: <span className="font-medium text-neutral-700 dark:text-neutral-300">{item.sourceName}</span>
                            </span>
                          )}
                          <span className="text-[11px] text-neutral-400">
                            {item.newsDate}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-snug">
                          {item.title}
                        </h3>

                        <p className="text-xs md:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                          {item.summary}
                        </p>

                        {/* Key Takeaway Box */}
                        {item.keyTakeaway && (
                          <div className="p-3 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs">
                            <span className="font-bold text-amber-700 dark:text-amber-400 block mb-0.5 flex items-center gap-1">
                              💡 Muhim Xulosa & Amaliy Foyda:
                            </span>
                            <span className="text-neutral-800 dark:text-neutral-200">
                              {item.keyTakeaway}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <button
                        onClick={() => copyNewsText(item)}
                        className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
                        title="Nusxa olish"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
                          title="Manbaga o'tish"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 4: GOOGLE EKOTIZIMI & MAHSULOTLAR                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "google" && (
        <div className="space-y-6">
          {/* Google Account Settings Card */}
          <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-500 via-amber-500 to-blue-500 flex items-center justify-center text-white shadow-md">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900 dark:text-white">
                    Google Hisobini Ulash & Sozlamalar
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Gemini Advanced, Google AI Studio va boshqa mahsulotlarga to&apos;g&apos;ridan-to&apos;g&apos;ri bog&apos;lanish
                  </p>
                </div>
              </div>

              {googleEmail && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <UserCheck className="w-4 h-4" /> Ulangan: {googleEmail}
                </div>
              )}
            </div>

            <form onSubmit={saveGoogleSettings} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Google Email manzili
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                      type="email"
                      placeholder="masalan: sohibjon@gmail.com"
                      value={googleEmail}
                      onChange={(e) => setGoogleEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Google Ism yoki Taxallus
                  </label>
                  <input
                    type="text"
                    placeholder="Sohibjon Sulaymonov"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Gemini API Kaliti (AI Yangiliklarini avtomat generatsiya qilish uchun)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="password"
                    placeholder="AIzaSy..."
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Bepul Gemini API kalitingizni{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 dark:text-purple-400 underline font-medium"
                  >
                    Google AI Studio
                  </a>{" "}
                  orqali olishingiz mumkin.
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                {settingsSavedSuccess ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Muvaffaqiyatli saqlandi!
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                >
                  {savingSettings ? "Saqlanmoqda..." : "Hisobni saqlash"}
                </button>
              </div>
            </form>
          </div>

          {/* Launchpad: Google Products */}
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-3">
              Google Mahsulotlari & Ilmiy Xizmatlar Markazi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {GOOGLE_PRODUCTS.map((prod) => {
                const Icon = prod.icon;
                return (
                  <a
                    key={prod.name}
                    href={prod.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08] shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${prod.gradient} flex items-center justify-center text-white shadow-sm`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                          {prod.badge}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-neutral-900 dark:text-white mt-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex items-center gap-1">
                        {prod.name}
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        {prod.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-medium">
                      <span>Ochish</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: UNIVERSITET QO'SHISH / TAHRIRLASH                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        open={uniModalOpen}
        onClose={() => setUniModalOpen(false)}
        title={editingUni ? "Universitetni tahrirlash" : "Yangi Universitet qo'shish"}
      >
        <form onSubmit={handleSaveUniversity} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Universitet nomi *</label>
            <input
              type="text"
              required
              placeholder="Masalan: INHA University in Tashkent"
              value={uniForm.name}
              onChange={(e) => setUniForm({ ...uniForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Davlat *</label>
              <input
                type="text"
                required
                value={uniForm.country}
                onChange={(e) => setUniForm({ ...uniForm, country: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Shahar</label>
              <input
                type="text"
                placeholder="Toshkent"
                value={uniForm.city}
                onChange={(e) => setUniForm({ ...uniForm, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Fakultet / Yo&apos;nalish *</label>
              <input
                type="text"
                required
                placeholder="Computer Science, AI, Business"
                value={uniForm.major}
                onChange={(e) => setUniForm({ ...uniForm, major: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Daraja</label>
              <select
                value={uniForm.degree}
                onChange={(e) => setUniForm({ ...uniForm, degree: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Bakalavr">Bakalavr</option>
                <option value="Magistratura">Magistratura</option>
                <option value="PhD">PhD / Doktorantura</option>
                <option value="Kurs">Kurs / Sertifikat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Kontrakt to&apos;lovi</label>
              <input
                type="text"
                placeholder="30,000,000 so'm / yil"
                value={uniForm.tuitionFee}
                onChange={(e) => setUniForm({ ...uniForm, tuitionFee: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Qabul muddati (Deadline)</label>
              <input
                type="date"
                value={uniForm.deadline}
                onChange={(e) => setUniForm({ ...uniForm, deadline: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-800 border border-black/[0.06] dark:border-white/[0.08]">
            <input
              type="checkbox"
              id="hasGrantCheck"
              checked={uniForm.hasGrant}
              onChange={(e) => setUniForm({ ...uniForm, hasGrant: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="hasGrantCheck" className="text-xs font-medium cursor-pointer">
              Grant yoki Stipendiya mavjud
            </label>
          </div>

          {uniForm.hasGrant && (
            <div>
              <label className="block text-xs font-semibold mb-1">Grant shartlari & miqdori</label>
              <input
                type="text"
                placeholder="100% davlat granti, a'lochilar uchun stipendiya..."
                value={uniForm.grantDetails}
                onChange={(e) => setUniForm({ ...uniForm, grantDetails: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">Qabul talablari (IELTS, SAT, imtihonlar)</label>
            <input
              type="text"
              placeholder="IELTS 6.0+, Matematika 140+ ball..."
              value={uniForm.requirements}
              onChange={(e) => setUniForm({ ...uniForm, requirements: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Status</label>
              <select
                value={uniForm.admissionStatus}
                onChange={(e) => setUniForm({ ...uniForm, admissionStatus: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="rejalashtirilgan">Rejalashtirilgan</option>
                <option value="hujjat_topshirildi">Hujjat topshirildi</option>
                <option value="qabul_qilindi">Qabul qilindi</option>
                <option value="rad_etildi">Rad etildi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Reyting / Nufuz</label>
              <input
                type="text"
                placeholder="QS #150 yoki O'zbekiston TOP-3"
                value={uniForm.ranking}
                onChange={(e) => setUniForm({ ...uniForm, ranking: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Rasmiy vebsayt havolasi</label>
            <input
              type="url"
              placeholder="https://..."
              value={uniForm.websiteUrl}
              onChange={(e) => setUniForm({ ...uniForm, websiteUrl: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Shaxsiy tahlil / Izohlar</label>
            <textarea
              rows={2}
              placeholder="Nima uchun qiziqarli, qanday imkoniyatlari bor..."
              value={uniForm.notes}
              onChange={(e) => setUniForm({ ...uniForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setUniModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20"
            >
              {editingUni ? "Yangilash" : "Qo'shish"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: ROADMAP QO'SHISH / TAHRIRLASH                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Modal
        open={roadmapModalOpen}
        onClose={() => setRoadmapModalOpen(false)}
        title={editingRoadmap ? "Rejani tahrirlash" : "Yangi Ko'nikma / Reja qo'shish"}
      >
        <form onSubmit={handleSaveRoadmap} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Mavzu / Ko&apos;nikma nomi *</label>
            <input
              type="text"
              required
              placeholder="Masalan: AI Agentlar va LangChain"
              value={roadmapForm.title}
              onChange={(e) => setRoadmapForm({ ...roadmapForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Kategoriya</label>
              <select
                value={roadmapForm.category}
                onChange={(e) => setRoadmapForm({ ...roadmapForm, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Dasturlash">Dasturlash</option>
                <option value="AI & ML">AI & ML</option>
                <option value="Til o'rganish">Til o&apos;rganish</option>
                <option value="Media & Kontent">Media & Kontent</option>
                <option value="Biznes & Moliya">Biznes & Moliya</option>
                <option value="Boshqa">Boshqa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Muhimlik darajasi</label>
              <select
                value={roadmapForm.priority}
                onChange={(e) => setRoadmapForm({ ...roadmapForm, priority: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="high">Yuqori / Shoshilinch</option>
                <option value="medium">O&apos;rta</option>
                <option value="low">Past</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">
              O&apos;zlashtirish foizi ({roadmapForm.progress}%)
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={roadmapForm.progress}
              onChange={(e) => setRoadmapForm({ ...roadmapForm, progress: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">O&apos;quv materiallari, kurslar va linklar</label>
            <input
              type="text"
              placeholder="YouTube playlist, kitob nomi, rasmiy docs..."
              value={roadmapForm.resources}
              onChange={(e) => setRoadmapForm({ ...roadmapForm, resources: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Izoh yoki maqsad</label>
            <textarea
              rows={2}
              placeholder="Nimaga erishmoqchiman..."
              value={roadmapForm.notes}
              onChange={(e) => setRoadmapForm({ ...roadmapForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-black/[0.08] dark:border-white/[0.08] focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRoadmapModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md shadow-emerald-500/20"
            >
              {editingRoadmap ? "Yangilash" : "Qo'shish"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
