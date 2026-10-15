"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Send,
  Video,
  Monitor,
  Globe,
  ExternalLink,
  Plus,
  Sparkles,
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Copy,
  Check,
  Image as ImageIcon,
  Upload,
  Layers,
  Folder,
  Eye,
  Download,
  Share2,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Bot,
  Zap,
  ChevronRight,
  Bookmark,
  Bell,
  PhoneCall,
} from "lucide-react";
import { Modal } from "@/components/Modal";

type SocialProfile = {
  id: number;
  name: string;
  platform: string;
  handle: string | null;
  url: string | null;
  avatarUrl: string | null;
  followersCount: number | null;
  category: string | null;
  description: string | null;
  status: string | null;
  createdAt: string;
  contentCount?: number;
  assetsCount?: number;
};

type ContentItem = {
  id: number;
  profileId: number | null;
  title: string;
  type: string;
  stage: string;
  caption: string | null;
  hook: string | null;
  body: string | null;
  cta: string | null;
  frames: string | null; // JSON array of frame URLs
  notified: boolean | null;
  mediaUrls: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  publishedAt: string | null;
  notes: string | null;
  createdAt: string;
};

type ProfileAsset = {
  id: number;
  profileId: number;
  title: string;
  type: string; // 'face' | 'monthly' | 'grid' | 'highlight'
  month: string | null; // e.g. '2026-10'
  fileUrl: string;
  fileType: string | null;
  caption: string | null;
  sortOrder: number | null;
  createdAt: string;
};

const PLATFORMS: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: any }
> = {
  instagram: {
    label: "Instagram",
    color: "text-pink-600 dark:text-pink-400",
    bg: "bg-gradient-to-tr from-amber-500/10 via-rose-500/10 to-purple-500/10",
    border: "border-rose-500/20",
    icon: Camera,
  },
  telegram: {
    label: "Telegram",
    color: "text-sky-500 dark:text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    icon: Send,
  },
  youtube: {
    label: "YouTube",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    icon: Video,
  },
  tiktok: {
    label: "TikTok",
    color: "text-slate-900 dark:text-slate-100",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    icon: Video,
  },
  behance: {
    label: "Behance",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    icon: Monitor,
  },
  facebook: {
    label: "Facebook",
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    icon: Globe,
  },
  other: {
    label: "Boshqa",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    icon: Globe,
  },
};

const STAGES: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  idea: {
    label: "G'oya",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
  },
  draft: {
    label: "Qoralama",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800",
    border: "border-slate-200 dark:border-slate-700",
  },
  in_progress: {
    label: "Jarayonda",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
  },
  ready: {
    label: "Tayyor",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    border: "border-purple-200 dark:border-purple-800",
  },
  published: {
    label: "Chop etilgan",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

const CONTENT_TYPES: Record<string, { label: string; icon: string }> = {
  post: { label: "Post (Rasm)", icon: "🖼️" },
  reels: { label: "Reels / Video", icon: "🎬" },
  carousel: { label: "Karusel (4 kadr)", icon: "📚" },
  story: { label: "Story", icon: "⚡" },
  article: { label: "Maqola / Matn", icon: "📝" },
  portfolio: { label: "Portfolio", icon: "💼" },
};

function getCurrentMonthKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(mKey: string) {
  const parts = mKey.split("-");
  if (parts.length !== 2) return mKey;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const months = [
    "Yanvar",
    "Fevral",
    "Mart",
    "Aprel",
    "May",
    "Iyun",
    "Iyul",
    "Avgust",
    "Sentabr",
    "Oktyabr",
    "Noyabr",
    "Dekabr",
  ];
  return `${months[monthNum - 1] || parts[1]} ${year}`;
}

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = Number(params?.id);

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [assets, setAssets] = useState<ProfileAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: 'content' | 'face' | 'monthly'
  const [activeTab, setActiveTab] = useState<"content" | "face" | "monthly">("content");

  // Filter for Content Reja
  const [contentStageFilter, setContentStageFilter] = useState<string>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<string>("all");

  // Monthly tab month selector
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());
  const [availableMonths, setAvailableMonths] = useState<string[]>([
    getCurrentMonthKey(),
  ]);

  // Modals & States
  const [editProfileModal, setEditProfileModal] = useState(false);
  const [addContentModal, setAddContentModal] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [uploadAssetModal, setUploadAssetModal] = useState(false);
  const [uploadAssetType, setUploadAssetType] = useState<"face" | "monthly" | "grid">("face");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Copy feedback states
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string>("");

  // Frames state for Content Modal (4 frames)
  const [contentFrames, setContentFrames] = useState<string[]>([]);

  // Drag over state for dropzone
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  function showToast(msg: string) {
    setCopiedNotification(msg);
    setTimeout(() => setCopiedNotification(null), 3000);
  }

  async function loadData() {
    if (!profileId) return;
    try {
      setLoading(true);
      const [pRes, cRes, aRes] = await Promise.all([
        fetch(`/api/profiles/${profileId}`),
        fetch(`/api/content?profileId=${profileId}`),
        fetch(`/api/profiles/assets?profileId=${profileId}`),
      ]);

      if (pRes.ok) {
        const pData = await pRes.json();
        setProfile(pData);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setContentList(cData);
      }
      if (aRes.ok) {
        const aData: ProfileAsset[] = await aRes.json();
        setAssets(aData);

        const monthsSet = new Set<string>();
        monthsSet.add(getCurrentMonthKey());
        aData.forEach((a) => {
          if (a.month) monthsSet.add(a.month);
        });
        const sorted = Array.from(monthsSet).sort().reverse();
        setAvailableMonths(sorted);
      }
    } catch (e) {
      console.error("Ma'lumotlarni yuklashda xatolik:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [profileId]);

  // Compress image if larger than 2MB for fast upload
  async function compressImageIfNeeded(file: File): Promise<File> {
    if (!file.type.startsWith("image/") || file.size < 2 * 1024 * 1024) {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxDim = 2000;
      let { width, height } = bitmap;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(bitmap, 0, 0, width, height);

      return new Promise<File>((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              resolve(file);
            }
          },
          "image/jpeg",
          0.85
        );
      });
    } catch {
      return file;
    }
  }

  // Upload single file to server
  async function uploadFileBlob(file: File): Promise<string | null> {
    try {
      setUploading(true);
      const readyFile = await compressImageIfNeeded(file);
      const fd = new FormData();
      fd.append("file", readyFile);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.error || "Faylni yuklashda server xatolik berdi");
        return null;
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      alert("Yuklashda tarmoq xatosi: " + (err?.message || "Serverga ulanib bo'lmadi"));
      return null;
    } finally {
      setUploading(false);
    }
  }

  // Save asset directly to database
  async function saveAssetDirectly(url: string, type: "face" | "monthly" | "grid", title?: string) {
    try {
      const res = await fetch("/api/profiles/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          title: title || (type === "face" ? "Feys referens rasm" : "Yuklangan kreativ"),
          type,
          month: type === "monthly" ? selectedMonth : null,
          fileUrl: url,
          fileType: "image",
        }),
      });
      if (res.ok) {
        loadData();
        showToast(
          type === "face"
            ? "✅ Feys referens rasm saqlandi! (AI uchun nusxalashingiz mumkin)"
            : `✅ ${formatMonthLabel(selectedMonth)} ga kontent saqlandi!`
        );
      }
    } catch (e) {
      console.error(e);
    }
  }

  // 1. GLOBAL CLIPBOARD PASTE HANDLER (Ctrl+V / Cmd+V)
  const handleGlobalPaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (!file) continue;

          e.preventDefault();
          showToast("⏳ Nusxalangan rasm yuklanmoqda...");
          const url = await uploadFileBlob(file);
          if (!url) {
            alert("Rasmni yuklashda xatolik yuz berdi");
            return;
          }

          // If content modal is currently open: add as frame
          if (addContentModal) {
            setContentFrames((prev) => [...prev, url]);
            showToast("✅ Rasm yangi kadr sifatida qo'shildi!");
            return;
          }

          // Otherwise save to current active tab
          if (activeTab === "face") {
            await saveAssetDirectly(url, "face", `Feys AI referens ${new Date().toLocaleTimeString()}`);
          } else if (activeTab === "monthly") {
            await saveAssetDirectly(url, "monthly", `Oylik kreativ ${new Date().toLocaleTimeString()}`);
          } else {
            // In content tab, open modal with this frame
            setContentFrames([url]);
            setUploadedUrl(url);
            setEditingContent(null);
            setAddContentModal(true);
            showToast("✅ Rasm biriktirildi, rejalashtirish oynasi ochildi!");
          }
          break;
        }
      }
    },
    [activeTab, addContentModal, selectedMonth, profileId]
  );

  useEffect(() => {
    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [handleGlobalPaste]);

  // 2. DRAG & DROP HANDLERS
  async function handleDropFiles(e: React.DragEvent) {
    e.preventDefault();
    setIsDraggingOver(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length === 0) return;

    showToast(`⏳ ${files.length} ta rasm yuklanmoqda...`);
    for (const file of files) {
      const url = await uploadFileBlob(file);
      if (!url) continue;

      if (addContentModal) {
        setContentFrames((prev) => [...prev, url]);
      } else if (activeTab === "face") {
        await saveAssetDirectly(url, "face", file.name.replace(/\.[^/.]+$/, ""));
      } else if (activeTab === "monthly") {
        await saveAssetDirectly(url, "monthly", file.name.replace(/\.[^/.]+$/, ""));
      } else {
        setContentFrames((prev) => [...prev, url]);
        setAddContentModal(true);
      }
    }
  }

  // 3. COPY IMAGE TO CLIPBOARD (for pasting into Midjourney, ChatGPT, Flux, Photoshop, etc.)
  async function copyImageToClipboard(assetUrl: string, assetTitle: string) {
    try {
      // First copy full URL to clipboard as universal fallback
      const fullUrl = assetUrl.startsWith("http")
        ? assetUrl
        : `${window.location.origin}${assetUrl}`;

      try {
        const response = await fetch(assetUrl);
        const blob = await response.blob();
        // Convert to PNG if JPEG/WEBP for best clipboard compatibility
        const imgBitmap = await createImageBitmap(blob);
        const canvas = document.createElement("canvas");
        canvas.width = imgBitmap.width;
        canvas.height = imgBitmap.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(imgBitmap, 0, 0);

        canvas.toBlob(async (pngBlob) => {
          if (pngBlob) {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": pngBlob }),
            ]);
            showToast("✨ Rasm buferga nusxalandi! Endi AI vositasiga Ctrl+V qiling!");
          }
        }, "image/png");
      } catch (clipErr) {
        // Fallback: copy image link
        await navigator.clipboard.writeText(fullUrl);
        showToast("🔗 Rasm havolasi nusxalandi! AI ga yuborishingiz mumkin.");
      }
    } catch (e) {
      console.error("Nusxa olishda xatolik:", e);
      showToast("❌ Nusxalashda xatolik");
    }
  }

  // Assets grouped
  const faceAssets = useMemo(() => {
    return assets.filter((a) => a.type === "face" || a.type === "highlight");
  }, [assets]);

  const gridAssets = useMemo(() => {
    const explicit = assets.filter((a) => a.type === "grid");
    if (explicit.length > 0) return explicit;
    return assets.slice(0, 9);
  }, [assets]);

  const monthlyAssets = useMemo(() => {
    return assets.filter(
      (a) => a.type === "monthly" && a.month === selectedMonth
    );
  }, [assets, selectedMonth]);

  // Filtered Content
  const filteredContent = useMemo(() => {
    return contentList.filter((item) => {
      if (contentStageFilter !== "all" && item.stage !== contentStageFilter) {
        return false;
      }
      if (contentTypeFilter !== "all" && item.type !== contentTypeFilter) {
        return false;
      }
      return true;
    });
  }, [contentList, contentStageFilter, contentTypeFilter]);

  const [modalTitleValue, setModalTitleValue] = useState("");

  // File Upload Handler (input change)
  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFileBlob(file);
    if (url) {
      setUploadedUrl(url);
      if (!modalTitleValue) {
        setModalTitleValue(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  }

  // Save Asset Form Modal
  async function handleSaveAssetForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!uploadedUrl) {
      alert("Iltimos, avval rasm yoki fayl yuklang!");
      return;
    }

    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") || "Nomsiz").trim();
    const caption = String(fd.get("caption") || "").trim();
    const type = uploadAssetType;

    await saveAssetDirectly(uploadedUrl, type, title);
    setUploadAssetModal(false);
    setUploadedUrl("");
  }

  // Delete Asset
  async function handleDeleteAsset(id: number) {
    if (!confirm("Haqiqatan ham bu rasmni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/profiles/assets?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Open Content Modal for Edit / Create
  function openContentModal(item?: ContentItem) {
    if (item) {
      setEditingContent(item);
      let frames: string[] = [];
      if (item.frames) {
        try {
          const parsed = JSON.parse(item.frames);
          if (Array.isArray(parsed)) frames = parsed;
        } catch {}
      }
      if (frames.length === 0 && item.mediaUrls) {
        frames = [item.mediaUrls];
      }
      setContentFrames(frames);
      setUploadedUrl(item.mediaUrls || "");
    } else {
      setEditingContent(null);
      setContentFrames([]);
      setUploadedUrl("");
    }
    setAddContentModal(true);
  }

  // Save Content Post with Hook, Body, CTA & 4 Frames
  async function handleSaveContent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const title = String(fd.get("title") || "").trim();
    if (!title) {
      alert("Sarlavha kiritilishi shart");
      return;
    }

    const hook = String(fd.get("hook") || "").trim() || null;
    const bodyText = String(fd.get("body") || "").trim() || null;
    const cta = String(fd.get("cta") || "").trim() || null;
    const caption = String(fd.get("caption") || "").trim() || null;

    const payload = {
      id: editingContent?.id,
      profileId,
      title,
      type: String(fd.get("type") || "carousel"),
      stage: String(fd.get("stage") || "idea"),
      hook,
      body: bodyText,
      cta,
      caption,
      frames: contentFrames.length > 0 ? JSON.stringify(contentFrames) : null,
      mediaUrls: contentFrames[0] || uploadedUrl || editingContent?.mediaUrls || null,
      scheduledDate: String(fd.get("scheduledDate") || "") || null,
      scheduledTime: String(fd.get("scheduledTime") || "") || null,
      notes: String(fd.get("notes") || ""),
    };

    try {
      const method = editingContent ? "PUT" : "POST";
      const res = await fetch("/api/content", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setAddContentModal(false);
        setEditingContent(null);
        setContentFrames([]);
        setUploadedUrl("");
        loadData();
        showToast("✅ Kontent rejalashtirildi! Belgilangan vaqtda yordamchi ogohlantiradi.");
      }
    } catch (e) {
      console.error(e);
      alert("Kontentni saqlashda xatolik");
    }
  }

  // Quick Stage Change
  async function handleStageChange(id: number, nextStage: string) {
    try {
      const res = await fetch("/api/content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, stage: nextStage }),
      });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  }

  // Delete Content Item
  async function handleDeleteContent(id: number) {
    if (!confirm("Ushbu kontentni o'chirmoqchimisiz?")) return;
    try {
      const res = await fetch(`/api/content?id=${id}`, { method: "DELETE" });
      if (res.ok) loadData();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading && !profile) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-slate-200 dark:bg-slate-800 rounded-full" />
        <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-12 text-center max-w-md mx-auto space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold">Profil topilmadi</h2>
        <p className="text-xs text-slate-500">
          Ushbu profil o'chirilgan yoki mavjud emas.
        </p>
        <Link
          href="/profillar"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Barcha profillarga qaytish
        </Link>
      </div>
    );
  }

  const pl = PLATFORMS[profile.platform] || PLATFORMS.other;
  const PlatformIcon = pl.icon;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDropFiles}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 relative min-h-screen"
    >
      {/* Toast Notification Banner */}
      {copiedNotification && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-300">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Fullscreen Drag Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-accent/20 backdrop-blur-sm border-4 border-dashed border-accent flex flex-col items-center justify-center p-8 pointer-events-none">
          <Upload className="w-16 h-16 text-accent animate-bounce mb-3" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">
            Rasmni shu yerga tashlang!
          </h2>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-1">
            Fayllar avtomatik yuklanadi va saqlanadi
          </p>
        </div>
      )}

      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/profillar"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors py-1"
        >
          <ArrowLeft className="w-4 h-4" /> Barcha profillar
        </Link>

        {/* Quick Paste Guide Hint */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
          <span className="font-mono bg-white dark:bg-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-700 dark:text-slate-200">
            Ctrl + V
          </span>
          <span>yoki rasmni sichqoncha bilan tashlang (Drag & Drop)</span>
        </div>
      </div>

      {/* Profile Header Hero Card */}
      <div className="glass rounded-3xl p-6 sm:p-8 border border-black/[0.05] dark:border-white/[0.06] shadow-sm relative overflow-hidden">
        <div
          className={`absolute -right-20 -top-20 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none ${pl.bg}`}
        />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="relative group">
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl ${pl.bg} border-2 ${pl.border} flex items-center justify-center shadow-md overflow-hidden relative`}
              >
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PlatformIcon className={`w-10 h-10 ${pl.color}`} />
                )}
              </div>
              <div
                className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm ${pl.color}`}
              >
                <PlatformIcon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
                  {profile.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {profile.category || "Dizayn"}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    profile.status === "paused"
                      ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      : profile.status === "growing"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  }`}
                >
                  {profile.status === "paused"
                    ? "Pauzada"
                    : profile.status === "growing"
                    ? "Rivojlanmoqda"
                    : "Faol"}
                </span>
              </div>

              {profile.handle && (
                <div className="text-sm font-mono text-slate-500 dark:text-slate-400">
                  {profile.handle.startsWith("@")
                    ? profile.handle
                    : `@${profile.handle}`}
                </div>
              )}

              {profile.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl line-clamp-2 pt-1 leading-relaxed">
                  {profile.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
            {profile.url && (
              <a
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Profilga o'tish
              </a>
            )}

            <button
              onClick={() => setEditProfileModal(true)}
              className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" /> Tahrirlash
            </button>
          </div>
        </div>

        {/* Mini stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              Auditoriya
            </span>
            <span className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              {(profile.followersCount || 0).toLocaleString()}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              Kontent reja
            </span>
            <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
              {contentList.length} ta post
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              AI Feys Referenslar
            </span>
            <span className="text-base sm:text-lg font-black text-purple-600 dark:text-purple-400">
              {faceAssets.length} ta rasm
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 block font-medium">
              Oylik fayllar ({formatMonthLabel(selectedMonth)})
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
              {monthlyAssets.length} ta fayl
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab("content")}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap px-1 ${
            activeTab === "content"
              ? "border-accent text-accent"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Kontent Reja (Hook, Body, CTA)
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {contentList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("face")}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap px-1 ${
            activeTab === "face"
              ? "border-accent text-accent"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Bot className="w-4 h-4 text-purple-500" />
          AI Feys Rasmlari & 9-Grid
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {faceAssets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("monthly")}
          className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap px-1 ${
            activeTab === "monthly"
              ? "border-accent text-accent"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Folder className="w-4 h-4" />
          Oylik Kontentlar
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            {monthlyAssets.length}
          </span>
        </button>
      </div>

      {/* ── TAB 1: KONTENT REJA (Hook, Body, CTA + 4 Kadr) ── */}
      {activeTab === "content" && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={contentStageFilter}
                onChange={(e) => setContentStageFilter(e.target.value)}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">Barcha bosqichlar</option>
                {Object.entries(STAGES).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                value={contentTypeFilter}
                onChange={(e) => setContentTypeFilter(e.target.value)}
                className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">Barcha formatlar</option>
                {Object.entries(CONTENT_TYPES).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => openContentModal()}
              className="px-5 py-2.5 rounded-full bg-accent text-white hover:bg-accent-hover text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" /> + 4 Kadrli Kontent Rejalashtirish
            </button>
          </div>

          {/* Assistant Reminder Banner Info */}
          <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Avtomatik Telegram Ogohlantirish</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500 text-white font-mono">
                    24/7 LIVE
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Rejalashtirilgan sana va vaqt kelganda, FlowDesk yordamchingiz sizga qo'ng'iroq qiladi va barcha kadrlar + Hook, Body, CTA ni Telegramingizga yuboradi!
                </div>
              </div>
            </div>
          </div>

          {/* Content Items List / Grid */}
          {filteredContent.length === 0 ? (
            <div className="glass p-12 text-center rounded-3xl border border-black/[0.04] dark:border-white/[0.06]">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                Ushbu filtr bo'yicha kontent topilmadi
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                4 ta kadr, Hook, Body va CTA bilan yangi kontent rejalashtiring!
              </p>
              <button
                onClick={() => openContentModal()}
                className="px-5 py-2 bg-accent text-white text-xs font-bold rounded-full hover:bg-accent-hover shadow-sm"
              >
                + Kontent qo'shish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredContent.map((item) => {
                const st = STAGES[item.stage] || STAGES.idea;
                const ct = CONTENT_TYPES[item.type] || CONTENT_TYPES.post;

                let framesList: string[] = [];
                if (item.frames) {
                  try {
                    const parsed = JSON.parse(item.frames);
                    if (Array.isArray(parsed)) framesList = parsed;
                  } catch {}
                }
                if (framesList.length === 0 && item.mediaUrls) {
                  framesList = [item.mediaUrls];
                }

                return (
                  <div
                    key={item.id}
                    className="glass rounded-3xl p-5 border border-black/[0.04] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span>{ct.icon}</span> {ct.label}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openContentModal(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Tahrirlash"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContent(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 4-Frames Thumbnail Row */}
                      {framesList.length > 0 && (
                        <div className="mb-3">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                            <span>Kadrlar ({framesList.length} ta)</span>
                            <span className="text-slate-400">Bosib ko'rish</span>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {framesList.slice(0, 4).map((frameUrl, idx) => (
                              <div
                                key={idx}
                                onClick={() => setPreviewImage(frameUrl)}
                                className="aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 relative group/frame cursor-pointer border border-black/[0.04] dark:border-white/[0.06]"
                              >
                                <img
                                  src={frameUrl}
                                  alt={`Kadr ${idx + 1}`}
                                  className="w-full h-full object-cover group-hover/frame:scale-105 transition-transform"
                                />
                                <div className="absolute top-1 left-1 px-1 py-0.2 bg-black/60 rounded text-[9px] text-white font-bold">
                                  #{idx + 1}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Title */}
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mb-2 leading-snug">
                        {item.title}
                      </h4>

                      {/* Hook, Body, CTA Structured Badges */}
                      <div className="space-y-2 mb-3">
                        {item.hook && (
                          <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl relative group/copy">
                            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                              <span>🪝 HOOK (ILMOQ):</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.hook!);
                                  showToast("🪝 Hook nusxalandi!");
                                }}
                                className="opacity-0 group-hover/copy:opacity-100 text-[10px] text-amber-600 hover:underline flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Nusxa
                              </button>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2 mt-0.5">
                              {item.hook}
                            </p>
                          </div>
                        )}

                        {item.body && (
                          <div className="bg-blue-500/10 border border-blue-500/20 p-2.5 rounded-xl relative group/copy">
                            <div className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center justify-between">
                              <span>📖 BODY (ASOSIY):</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.body!);
                                  showToast("📖 Body nusxalandi!");
                                }}
                                className="opacity-0 group-hover/copy:opacity-100 text-[10px] text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Nusxa
                              </button>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2 mt-0.5">
                              {item.body}
                            </p>
                          </div>
                        )}

                        {item.cta && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl relative group/copy">
                            <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                              <span>🎯 CTA (HARAKAT):</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.cta!);
                                  showToast("🎯 CTA nusxalandi!");
                                }}
                                className="opacity-0 group-hover/copy:opacity-100 text-[10px] text-emerald-600 hover:underline flex items-center gap-1"
                              >
                                <Copy className="w-3 h-3" /> Nusxa
                              </button>
                            </div>
                            <p className="text-xs text-slate-700 dark:text-slate-300 font-medium line-clamp-2 mt-0.5">
                              {item.cta}
                            </p>
                          </div>
                        )}

                        {/* Full caption if present */}
                        {item.caption && !item.hook && !item.body && (
                          <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                            {item.caption}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Status & Schedule */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        {item.scheduledDate ? (
                          <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
                            <Clock className="w-3.5 h-3.5 text-accent" />
                            {item.scheduledDate} {item.scheduledTime || ""}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Reja vaqti yo'q</span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${st.bg} ${st.color} ${st.border}`}
                        >
                          {st.label}
                        </span>
                      </div>

                      {/* Quick stage toggle pills */}
                      <div className="flex items-center gap-1 pt-1 overflow-x-auto scrollbar-none">
                        {Object.entries(STAGES).map(([k, s]) => (
                          <button
                            key={k}
                            onClick={() => handleStageChange(item.id, k)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all ${
                              item.stage === k
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: FEYS RASMLARI (AI REFERENS BANKI - NOT PUBLISHED POSTS) ── */}
      {activeTab === "face" && (
        <div className="space-y-8">
          {/* AI Face Bank Explanatory Banner */}
          <div className="p-5 rounded-3xl bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-amber-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Sun'iy Intellekt (AI) Referens & Feys Banki</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500 text-white font-mono">
                    Post emas
                  </span>
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
                  Bu rasmlar <b>ijtimoiy tarmoqqa post qilinmaydi!</b> Bu sizning shaxsiy feys va brending referenslaringiz: Midjourney, Flux, ChatGPT, HeyGen va AI vositalarida yangi kadrlar yaratish uchun bitta tugma bilan nusxa olib (`Ctrl+V`) ishlatasiz.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="cursor-pointer px-4 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all">
                <Plus className="w-4 h-4" /> Rasm tanlash (Tezkor)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    showToast(`⏳ ${files.length} ta rasm yuklanmoqda...`);
                    for (const f of files) {
                      const url = await uploadFileBlob(f);
                      if (url) {
                        await saveAssetDirectly(url, "face", f.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
              </label>

              <button
                onClick={() => {
                  setUploadAssetType("face");
                  setUploadedUrl("");
                  setUploadAssetModal(true);
                }}
                className="px-3.5 py-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                title="Nom va izoh bilan yuklash"
              >
                Qo'lda nomlash
              </button>
            </div>
          </div>

          {/* Quick AI Modellar Launcher */}
          <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>AI Modellar & Vositalar</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-400 font-semibold">
                    1-Click Ochiq
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Feys rasmingizdan nusxa olib, to'g'ridan-to'g'ri AI modelida yangi kadr yarating.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="https://discord.com/channels/@me"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition-all"
              >
                Midjourney ↗
              </a>
              <a
                href="https://fal.ai"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition-all"
              >
                Flux.1 ↗
              </a>
              <a
                href="https://klingai.com"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition-all"
              >
                Kling AI ↗
              </a>
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm transition-all"
              >
                ChatGPT ↗
              </a>
              <Link
                href="/ai-modellar"
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-semibold inline-flex items-center gap-1 transition-all"
              >
                Barcha AI modellar →
              </Link>
            </div>
          </div>

          {/* Feys Rasmlari Gallery */}
          <div className="glass rounded-3xl p-6 sm:p-8 border border-black/[0.04] dark:border-white/[0.06] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-purple-500" /> Mavjud Feys Referenslari ({faceAssets.length})
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Istalgan rasm ustidagi <b>"Nusxa olish"</b> tugmasini bosing — rasm clipboardga tushadi, so'ng AI dasturiga tashlang.
                </p>
              </div>
            </div>

            {faceAssets.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <Bot className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500 mb-3">
                  Hali feys rasmlari yuklanmagan. Istalgan rasmni sahifaga <b>Ctrl + V</b> qiling yoki fayl tanlang!
                </p>
                <label className="cursor-pointer px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-full hover:bg-purple-700 shadow-sm inline-flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> + Rasm tanlash
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      showToast(`⏳ ${files.length} ta rasm yuklanmoqda...`);
                      for (const f of files) {
                        const url = await uploadFileBlob(f);
                        if (url) {
                          await saveAssetDirectly(url, "face", f.name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {faceAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="group relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 aspect-square border border-black/[0.04] dark:border-white/[0.06] shadow-sm flex flex-col justify-between"
                  >
                    <img
                      src={asset.fileUrl}
                      alt={asset.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Quick Copy Button on Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2.5 flex flex-col justify-between">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setPreviewImage(asset.fileUrl)}
                          className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-xs"
                          title="Ko'rish"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="p-1.5 rounded-full bg-rose-500/80 hover:bg-rose-500 text-white"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-white text-xs font-bold truncate">
                          {asset.title}
                        </div>
                        <button
                          onClick={() => copyImageToClipboard(asset.fileUrl, asset.title)}
                          className="w-full py-1.5 px-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <Copy className="w-3 h-3" />
                          <span>AI uchun Nusxa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Instagram 9-Grid (Visual Feed Simulator) */}
          <div className="glass rounded-3xl p-6 sm:p-8 border border-black/[0.04] dark:border-white/[0.06] shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Camera className="w-5 h-5 text-pink-500" /> Instagram 9-Grid (Feed Simulyatori)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Lentadagi 9 ta kadr bir-biri bilan qanday uyg'unlashishini oldindan tekshiring
                </p>
              </div>

              <button
                onClick={() => {
                  setUploadAssetType("grid");
                  setUploadedUrl("");
                  setUploadAssetModal(true);
                }}
                className="px-4 py-2 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" /> Gridga rasm qo'shish
              </button>
            </div>

            {/* Instagram Profile Mockup */}
            <div className="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-lg space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-500">
                  <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 p-0.5 overflow-hidden">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Camera className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {profile.handle || profile.name}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {gridAssets.length}
                      </span>{" "}
                      post
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {(profile.followersCount || 0).toLocaleString()}
                      </span>{" "}
                      obunachi
                    </div>
                  </div>
                </div>
              </div>

              {/* 3x3 Grid */}
              <div className="grid grid-cols-3 gap-1 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 p-1">
                {Array.from({ length: 9 }).map((_, index) => {
                  const item = gridAssets[index];
                  return (
                    <div
                      key={index}
                      onClick={() => item && setPreviewImage(item.fileUrl)}
                      className="aspect-square bg-slate-200 dark:bg-slate-800/80 rounded-lg overflow-hidden relative group cursor-pointer flex items-center justify-center"
                    >
                      {item ? (
                        <>
                          <img
                            src={item.fileUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye className="w-4 h-4" />
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          #{index + 1}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="text-[11px] text-slate-400 text-center">
                ✨ 9-Grid estetikasi: ranglar va kompozitsiya uyg'unligi
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: OYLIK KONTENTLAR ── */}
      {activeTab === "monthly" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">Oy:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                {availableMonths.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMonth(m)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      selectedMonth === m
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
                    }`}
                  >
                    {formatMonthLabel(m)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all">
                <Upload className="w-4 h-4" /> {formatMonthLabel(selectedMonth)} ga yuklash (Tezkor)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    showToast(`⏳ ${files.length} ta rasm yuklanmoqda...`);
                    for (const f of files) {
                      const url = await uploadFileBlob(f);
                      if (url) {
                        await saveAssetDirectly(url, "monthly", f.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
              </label>

              <button
                onClick={() => {
                  setUploadAssetType("monthly");
                  setUploadedUrl("");
                  setUploadAssetModal(true);
                }}
                className="px-3.5 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
                title="Nom va izoh bilan yuklash"
              >
                Qo'lda nomlash
              </button>
            </div>
          </div>

          {monthlyAssets.length === 0 ? (
            <div className="glass p-12 text-center rounded-3xl border border-black/[0.04] dark:border-white/[0.06]">
              <div className="w-14 h-14 mx-auto mb-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center">
                <Folder className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-1">
                {formatMonthLabel(selectedMonth)} uchun kontentlar yo'q
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                Ushbu oy uchun tayyorlangan bannerlar, dizaynlar va videolarni yuklang yoki to'g'ridan-to'g'ri <b>Ctrl + V</b> qiling!
              </p>
              <label className="cursor-pointer px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-full shadow-sm inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> + Fayl tanlash
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;
                    showToast(`⏳ ${files.length} ta rasm yuklanmoqda...`);
                    for (const f of files) {
                      const url = await uploadFileBlob(f);
                      if (url) {
                        await saveAssetDirectly(url, "monthly", f.name.replace(/\.[^/.]+$/, ""));
                      }
                    }
                  }}
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {monthlyAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="glass rounded-3xl p-3 border border-black/[0.04] dark:border-white/[0.06] shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div
                    onClick={() => setPreviewImage(asset.fileUrl)}
                    className="w-full aspect-square rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer relative group/img mb-3"
                  >
                    <img
                      src={asset.fileUrl}
                      alt={asset.title}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Eye className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {asset.title}
                    </h4>
                    {asset.caption && (
                      <p className="text-[11px] text-slate-500 truncate">
                        {asset.caption}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-slate-400">
                    <span className="text-[10px]">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyImageToClipboard(asset.fileUrl, asset.title)}
                        className="p-1 text-slate-400 hover:text-purple-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Nusxa olish"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={asset.fileUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-emerald-600 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="Yuklab olish"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1 text-slate-400 hover:text-rose-500 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="O'chirish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: YUKLASH (FECE / MONTHLY / GRID) ── */}
      <Modal
        open={uploadAssetModal}
        onClose={() => {
          setUploadAssetModal(false);
          setUploadedUrl("");
        }}
        title={
          uploadAssetType === "face"
            ? "AI Feys Referens Rasmi Yuklash"
            : uploadAssetType === "grid"
            ? "Instagram Grid uchun rasm"
            : `${formatMonthLabel(selectedMonth)} uchun kontent yuklash`
        }
      >
        <form onSubmit={handleSaveAssetForm} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Rasm yoki Fayl * (yoki Ctrl + V bosing)
            </label>
            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-center hover:border-accent transition-colors relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              {uploading ? (
                <div className="py-4 text-xs text-accent font-semibold flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  Yuklanmoqda...
                </div>
              ) : uploadedUrl ? (
                <div className="space-y-2">
                  <img
                    src={uploadedUrl}
                    alt="Preview"
                    className="w-24 h-24 object-cover mx-auto rounded-xl shadow-xs"
                  />
                  <div className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Rasm yuklandi! (Boshqasini tanlash uchun bosing)
                  </div>
                </div>
              ) : (
                <div className="py-4 space-y-1">
                  <Upload className="w-8 h-8 text-slate-400 mx-auto mb-1" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Faylni tanlang yoki tashlang (Drag & Drop)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    PNG, JPG, WEBP formatlar (maks. 25MB)
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Sarlavha / Nomi *
            </label>
            <input
              name="title"
              required
              value={modalTitleValue}
              onChange={(e) => setModalTitleValue(e.target.value)}
              placeholder={
                uploadAssetType === "face"
                  ? "Masalan: Feys - Tabassum, yoki Studio Oq fon"
                  : "Kreativ nomi"
              }
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Qo'shimcha izoh / Tavsif
            </label>
            <textarea
              name="caption"
              rows={2}
              placeholder="Foydalanish bo'yicha ko'rsatma yoki matn..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setUploadAssetModal(false);
                setUploadedUrl("");
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={uploading || !uploadedUrl}
              className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors shadow-sm"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: 4-KADRLI KONTENT REJALASHTIRISH (Hook, Body, CTA) ── */}
      <Modal
        open={addContentModal}
        onClose={() => {
          setAddContentModal(false);
          setEditingContent(null);
          setContentFrames([]);
          setUploadedUrl("");
        }}
        title={editingContent ? "Kontentni Tahrirlash" : "4 Kadrli Kontent Rejalashtirish"}
      >
        <form onSubmit={handleSaveContent} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Sarlavha (Mavzu) *
            </label>
            <input
              name="title"
              required
              defaultValue={editingContent?.title || ""}
              placeholder="Masalan: Qanday qilib 1 oyda brendingni noldan qurdik?"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          {/* 4 FRAMES / KADRLAR BO'LIMI */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <span>🖼️ 4 ta Kadr (Karusel / Storyboard):</span>
                <span className="text-[11px] text-slate-400">({contentFrames.length} ta kadr)</span>
              </label>
              <div className="text-[10px] text-slate-400 font-mono">
                Ctrl+V yoki Drag qiling
              </div>
            </div>

            {/* Frame Thumbnails Grid */}
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: Math.max(4, contentFrames.length) }).map((_, idx) => {
                const frameUrl = contentFrames[idx];
                return (
                  <div
                    key={idx}
                    className="aspect-square rounded-xl overflow-hidden bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 relative group/slot flex flex-col items-center justify-center"
                  >
                    {frameUrl ? (
                      <>
                        <img
                          src={frameUrl}
                          alt={`Kadr ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 rounded text-[9px] text-white font-bold">
                          #{idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setContentFrames((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="absolute top-1 right-1 p-1 bg-rose-500 rounded-full text-white opacity-0 group-hover/slot:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer p-1 text-center hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                        <Upload className="w-4 h-4 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-500 font-bold">
                          {idx + 1}-kadr
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              const u = await uploadFileBlob(f);
                              if (u) setContentFrames((prev) => [...prev, u]);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* HOOK, BODY, CTA STRUCTURED FIELDS */}
          <div className="space-y-3 pt-1">
            {/* HOOK */}
            <div>
              <label className="block text-xs font-bold text-amber-700 dark:text-amber-400 mb-1 flex items-center justify-between">
                <span>🪝 1. Hook (Kirish / Ilmoq) *</span>
                <span className="text-[10px] font-normal text-slate-400">
                  Dastlabki 3 soniyada to'xtatuvchi kuchli sarlavha
                </span>
              </label>
              <textarea
                name="hook"
                rows={2}
                defaultValue={editingContent?.hook || ""}
                placeholder="Masalan: Dizaynerlar sizdan yashiradigan 3 ta sir..."
                className="w-full px-4 py-2 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>

            {/* BODY */}
            <div>
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-400 mb-1 flex items-center justify-between">
                <span>📖 2. Body (Asosiy qism / Qiymat) *</span>
                <span className="text-[10px] font-normal text-slate-400">
                  2, 3 va 4-kadrlardagi asosiy ma'lumot
                </span>
              </label>
              <textarea
                name="body"
                rows={3}
                defaultValue={editingContent?.body || ""}
                placeholder="Masalan: 1-kadrda muammo, 2-kadrda yechim, 3-kadrda natija..."
                className="w-full px-4 py-2 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            {/* CTA */}
            <div>
              <label className="block text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 flex items-center justify-between">
                <span>🎯 3. CTA (Harakatga chaqiruv) *</span>
                <span className="text-[10px] font-normal text-slate-400">
                  Oxirgi kadr va izohga chaqiruv
                </span>
              </label>
              <textarea
                name="cta"
                rows={2}
                defaultValue={editingContent?.cta || ""}
                placeholder="Masalan: Izohda 'DIZAYN' deb yozing, qo'llanmani yuboraman!"
                className="w-full px-4 py-2 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Schedule Date & Time */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-accent" /> Reja sanasi
              </label>
              <input
                type="date"
                name="scheduledDate"
                defaultValue={editingContent?.scheduledDate || ""}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-accent" /> Reja vaqti (Soat)
              </label>
              <input
                type="time"
                name="scheduledTime"
                defaultValue={editingContent?.scheduledTime || ""}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <PhoneCall className="w-4 h-4 shrink-0 text-blue-500" />
            <span>
              Shu soat kelganda FlowDesk Telegram yordamchisi telefon qilib, Hook, Body, CTA va kadrlarni chatga tashlaydi.
            </span>
          </div>

          {/* Format & Stage */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Format
              </label>
              <select
                name="type"
                defaultValue={editingContent?.type || "carousel"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              >
                {Object.entries(CONTENT_TYPES).map(([k, t]) => (
                  <option key={k} value={k}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Bosqich
              </label>
              <select
                name="stage"
                defaultValue={editingContent?.stage || "idea"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              >
                {Object.entries(STAGES).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Optional Caption */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              To'liq post matni (Caption - ixtiyoriy)
            </label>
            <textarea
              name="caption"
              rows={3}
              defaultValue={editingContent?.caption || ""}
              placeholder="Xeshteglar, to'liq matn yoki eslatma..."
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900 py-2">
            <button
              type="button"
              onClick={() => {
                setAddContentModal(false);
                setEditingContent(null);
                setContentFrames([]);
              }}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shadow-sm"
            >
              {editingContent ? "O'zgarishlarni saqlash" : "Rejalashtirish"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── MODAL: PROFILNI TAHRIRLASH ── */}
      <Modal
        open={editProfileModal}
        onClose={() => setEditProfileModal(false)}
        title="Profil ma'lumotlarini tahrirlash"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);

            const payload = {
              name: String(fd.get("name") || "").trim(),
              platform: String(fd.get("platform") || "instagram").trim(),
              handle: String(fd.get("handle") || "").trim() || null,
              url: String(fd.get("url") || "").trim() || null,
              category: String(fd.get("category") || "Dizayn").trim(),
              followersCount: Number(fd.get("followersCount")) || 0,
              description: String(fd.get("description") || "").trim() || null,
              status: String(fd.get("status") || "active").trim(),
              avatarUrl: uploadedUrl || profile.avatarUrl || null,
            };

            try {
              const res = await fetch(`/api/profiles/${profile.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              if (res.ok) {
                setEditProfileModal(false);
                setUploadedUrl("");
                loadData();
              }
            } catch (err) {
              console.error(err);
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Profil nomi *
            </label>
            <input
              name="name"
              required
              defaultValue={profile.name}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Platforma
              </label>
              <select
                name="platform"
                defaultValue={profile.platform}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              >
                {Object.entries(PLATFORMS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Holati
              </label>
              <select
                name="status"
                defaultValue={profile.status || "active"}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="active">Faol</option>
                <option value="growing">Rivojlanmoqda</option>
                <option value="paused">Pauzada</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Username / Handle
              </label>
              <input
                name="handle"
                defaultValue={profile.handle || ""}
                placeholder="@username"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Auditoriya soni
              </label>
              <input
                type="number"
                name="followersCount"
                defaultValue={profile.followersCount || 0}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Havola (URL)
            </label>
            <input
              type="url"
              name="url"
              defaultValue={profile.url || ""}
              placeholder="https://instagram.com/..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Kategoriya
            </label>
            <input
              name="category"
              defaultValue={profile.category || "Dizayn"}
              placeholder="Dizayn, Shaxsiy brend, IT, ..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Avatar / Logotip yangilash
            </label>
            <div className="border border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                className="text-xs text-slate-500"
              />
              {(uploadedUrl || profile.avatarUrl) && (
                <img
                  src={uploadedUrl || profile.avatarUrl || ""}
                  alt="Avatar"
                  className="w-10 h-10 object-cover rounded-full shrink-0"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Tavsif (Bio)
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={profile.description || ""}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setEditProfileModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover transition-colors shadow-sm"
            >
              Saqlash
            </button>
          </div>
        </form>
      </Modal>

      {/* ── IMAGE ZOOM / PREVIEW MODAL ── */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl bg-slate-900 shadow-2xl">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-h-[85vh] w-auto object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
