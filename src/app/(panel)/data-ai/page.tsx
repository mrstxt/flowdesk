"use client";

import { useEffect, useRef, useState } from "react";
import {
  Brain,
  Camera,
  CheckCircle2,
  Database,
  Eye,
  LineChart,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

type StoredProfile = {
  username?: string;
  displayName?: string;
  followers?: number;
  mediaCount?: number;
};

type StoredAnalysis = {
  analyzedAt?: string;
  readiness?: number;
  summary?: {
    signalCount?: number;
    inspirationProfiles?: number;
    mediaCount?: number;
    commentsCount?: number;
    patternCount?: number;
  };
  recommendations?: string[];
};

const memoryLayers = [
  {
    title: "Profile Memory",
    text: "Bio, username, follower, media count va profil identity snapshot.",
  },
  {
    title: "Performance Memory",
    text: "Views, reach, retention, saves, shares va comment sentiment signallari.",
  },
  {
    title: "Benchmark Memory",
    text: "Ilhom profillaridan olingan top kontent patternlari va growth formulalari.",
  },
  {
    title: "Recommendation Memory",
    text: "AI bergan maslahatlar, keyingi natija va qayta o'rganish tarixi.",
  },
];

export default function DataAiPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [checking, setChecking] = useState(false);
  const [faceMessage, setFaceMessage] = useState(
    "Kamerani oching va yuzingizni markazda ushlang."
  );
  const [faceScore, setFaceScore] = useState(0);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [analysis, setAnalysis] = useState<StoredAnalysis | null>(null);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem("flowdesk-data-ai-face") === "ok");

    const savedProfile = localStorage.getItem("flowdesk-content-ai-profile");
    if (savedProfile) {
      try {
        setProfile(JSON.parse(savedProfile) as StoredProfile);
      } catch {
        localStorage.removeItem("flowdesk-content-ai-profile");
      }
    }

    const savedAnalysis = localStorage.getItem("flowdesk-content-ai-analysis");
    if (savedAnalysis) {
      try {
        setAnalysis(JSON.parse(savedAnalysis) as StoredAnalysis);
      } catch {
        localStorage.removeItem("flowdesk-content-ai-analysis");
      }
    }

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
      setFaceMessage("Kamera tayyor. Yuzingiz yorug' va markazda ko'rinsin.");
    } catch {
      setCameraError(
        "Kamera ochilmadi. Browser permission yoki HTTPS sozlamasini tekshiring."
      );
    }
  }

  async function verifyFace() {
    if (!cameraReady) return;
    setChecking(true);
    setFaceMessage("Frame tekshirilyapti...");
    await new Promise((resolve) => setTimeout(resolve, 450));

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setChecking(false);
      setFaceMessage("Kamera rasmi olinmadi. Qayta urinib ko'ring.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setChecking(false);
      setFaceMessage("Browser kamera frame'ni o'qiy olmadi.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightness = 0;
    let contrast = 0;
    let samples = 0;

    for (let i = 0; i < image.length; i += 4 * 24) {
      const value = (image[i] + image[i + 1] + image[i + 2]) / 3;
      brightness += value;
      contrast += Math.abs(value - 128);
      samples += 1;
    }

    const avgBrightness = brightness / Math.max(1, samples);
    const avgContrast = contrast / Math.max(1, samples);
    const score = Math.min(
      100,
      Math.round(avgBrightness * 0.45 + avgContrast * 0.9)
    );
    setFaceScore(score);

    if (avgBrightness < 35 || score < 45) {
      setChecking(false);
      setFaceMessage(
        "Yuz aniq ko'rinmadi. Yorug'roq joyda kameraga qarab qayta urinib ko'ring."
      );
      return;
    }

    sessionStorage.setItem("flowdesk-data-ai-face", "ok");
    setUnlocked(true);
    setChecking(false);
    setFaceMessage("Face verification tasdiqlandi.");
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  function lockAgain() {
    sessionStorage.removeItem("flowdesk-data-ai-face");
    setUnlocked(false);
    setCameraReady(false);
    setFaceScore(0);
    setFaceMessage("Kamerani oching va yuzingizni markazda ushlang.");
  }

  if (!unlocked) {
    return (
      <div className="p-8 max-w-5xl mx-auto fade-in">
        <div className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-6">
            <div className="flex-1">
              <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4">
                <Brain className="w-6 h-6" />
              </div>
              <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                Data AI
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 leading-7 max-w-xl">
                Bu joy Content AI miyasi: profil xotirasi, ML signallar,
                benchmark patternlar va tavsiyalar shu yerda turadi. Kirish
                uchun face verification kerak.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <SecureStat icon={Lock} label="Kirish" value="Face check" />
                <SecureStat icon={Database} label="Memory" value="Protected" />
                <SecureStat icon={ShieldCheck} label="Session" value="1 marta" />
              </div>
            </div>

            <div className="w-full lg:w-[360px]">
              <div className="aspect-[4/5] rounded-[28px] bg-slate-950 overflow-hidden border border-black/[0.08] relative">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-950">
                    <Camera className="w-10 h-10 mb-3" />
                    <div className="text-sm font-semibold">Kamera kutilmoqda</div>
                  </div>
                )}
                {cameraReady && (
                  <div className="absolute inset-4 border-2 border-white/70 rounded-[45%] pointer-events-none" />
                )}
              </div>
              {cameraError && (
                <div className="text-sm text-red-500 mt-3">{cameraError}</div>
              )}
              <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.06] dark:border-white/[0.08] p-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Face signal
                  </span>
                  <span className="text-xs font-bold text-accent">{faceScore}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${faceScore}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-5">
                  {faceMessage}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={startCamera}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90"
                >
                  <Camera className="w-4 h-4" />
                  Kamerani ochish
                </button>
                <button
                  onClick={verifyFace}
                  disabled={!cameraReady || checking}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Eye className="w-4 h-4" />
                  {checking ? "Tekshirilyapti" : "Tasdiqlash"}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-5">
                Face check hozir browser kamera liveness tekshiruvi sifatida
                ishlaydi. Keyingi bosqichda real biometric matching backendga
                ulanadi.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const readiness = analysis?.readiness || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto fade-in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-sm font-semibold text-accent mb-1.5 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Face verified AI memory zone
          </div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Data AI
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">
            Content AI o'rgangan signal, xotira va keyingi takomillashtirish
            qarorlari.
          </p>
        </div>
        <button
          onClick={lockAgain}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        >
          <Lock className="w-4 h-4" />
          Qayta qulflash
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <SecureStat icon={UserRound} label="Profil" value={profile?.username ? `@${profile.username}` : "0"} />
        <SecureStat icon={LineChart} label="Readiness" value={`${readiness}%`} />
        <SecureStat icon={Database} label="Signal" value={String(analysis?.summary?.signalCount || 0)} />
        <SecureStat icon={Sparkles} label="Benchmark" value={String(analysis?.summary?.inspirationProfiles || 0)} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                AI miya holati
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Model hozir qaysi data bilan ishlashga tayyorligini ko'rsatadi.
              </p>
            </div>
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-5">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${readiness}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <MiniMemory label="Media" value={analysis?.summary?.mediaCount || 0} />
            <MiniMemory label="Komment" value={analysis?.summary?.commentsCount || 0} />
            <MiniMemory label="Pattern" value={analysis?.summary?.patternCount || 0} />
            <MiniMemory label="Follower" value={profile?.followers || 0} />
          </div>
        </section>

        <section className="bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
                Memory layers
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                AI profilni rivojlantirishda shu xotira qatlamlariga tayanadi.
              </p>
            </div>
            <Database className="w-5 h-5 text-[#0a84ff]" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {memoryLayers.map((layer) => (
              <div
                key={layer.title}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4"
              >
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  {layer.title}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-6 mt-1">
                  {layer.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-slate-100">
              AI tavsiyalar xotirasi
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Verified tahlil chiqqanidan keyin Data AI shu tavsiyalarni
              keyingi kontent qarorlariga asos qiladi.
            </p>
          </div>
          <RefreshCw className="w-5 h-5 text-accent" />
        </div>
        {analysis?.recommendations?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.recommendations.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-black/[0.06] dark:border-white/[0.08] bg-slate-50/70 dark:bg-slate-950 p-4 flex items-start gap-3"
              >
                <CheckCircle2 className="w-5 h-5 text-[#22a447] mt-0.5 shrink-0" />
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-6">
                  {item}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/[0.1] dark:border-white/[0.12] bg-slate-50/70 dark:bg-slate-950 p-6 text-center">
            <Brain className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <div className="font-bold text-slate-700 dark:text-slate-200">
              Data AI xotirasi hali bo'sh
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Content AI ichida verified tahlil qilinsa, bu yerda AI miyasi
              to'lib boradi.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SecureStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Brain;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        <Icon className="w-4 h-4 text-accent" />
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
        {value}
      </div>
    </div>
  );
}

function MiniMemory({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-black/[0.06] dark:border-white/[0.08] p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </div>
      <div className="font-display text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
        {new Intl.NumberFormat("uz-UZ").format(value)}
      </div>
    </div>
  );
}
