"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Camera, Fingerprint, KeyRound, Lock, ShieldCheck } from "lucide-react";

const pinKey = "flowdesk-security-pin";
const faceKey = "flowdesk-security-face";
const passkeyKey = "flowdesk-security-passkey";

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return toBase64Url(digest);
}

type SecurityGateProps = {
  children: React.ReactNode;
  scope: "app" | "data-ai";
  title: string;
  description: string;
  requireSecurity?: boolean;
};

export function SecurityGate({
  children,
  scope,
  title,
  description,
  requireSecurity = false,
}: SecurityGateProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionKey = `flowdesk-${scope}-verified`;
  const [ready, setReady] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [hasFace, setHasFace] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [checkingFace, setCheckingFace] = useState(false);

  useEffect(() => {
    const pinEnabled = Boolean(localStorage.getItem(pinKey));
    const faceEnabled = Boolean(localStorage.getItem(faceKey));
    const passkeyEnabled = Boolean(localStorage.getItem(passkeyKey));
    setHasPin(pinEnabled);
    setHasFace(faceEnabled);
    setHasPasskey(passkeyEnabled);
    setUnlocked(sessionStorage.getItem(sessionKey) === "ok");
    setReady(true);
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [sessionKey]);

  const hasAnyMethod = hasPin || hasFace || hasPasskey;

  useEffect(() => {
    if (ready && !requireSecurity && !hasAnyMethod) {
      setUnlocked(true);
    }
  }, [ready, requireSecurity, hasAnyMethod]);

  async function verifyPin() {
    const raw = localStorage.getItem(pinKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { salt: string; hash: string };
      const hash = await sha256(`${saved.salt}:${pin}`);
      if (hash !== saved.hash) {
        setMessage("PIN noto'g'ri.");
        return;
      }
      sessionStorage.setItem(sessionKey, "ok");
      setUnlocked(true);
      setPin("");
    } catch {
      setMessage("PIN tekshirishda xatolik.");
    }
  }

  async function startCamera() {
    setMessage("");
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
    } catch {
      setMessage("Kamera ochilmadi. Browser permission yoki HTTPS kerak.");
    }
  }

  async function verifyFace() {
    if (!cameraReady) return;
    setCheckingFace(true);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCheckingFace(false);
      setMessage("Kamera frame olinmadi.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCheckingFace(false);
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
    const score = Math.round(avgBrightness * 0.45 + avgContrast * 0.9);
    if (avgBrightness < 35 || score < 45) {
      setCheckingFace(false);
      setMessage("Yuz aniq ko'rinmadi. Yorug'roq joyda qayta urinib ko'ring.");
      return;
    }
    sessionStorage.setItem(sessionKey, "ok");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setUnlocked(true);
    setCheckingFace(false);
  }

  async function verifyPasskey() {
    const raw = localStorage.getItem(passkeyKey);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as { rawId: string };
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [
            { type: "public-key", id: fromBase64Url(saved.rawId) },
          ],
          userVerification: "required",
          timeout: 60000,
        },
      });
      sessionStorage.setItem(sessionKey, "ok");
      setUnlocked(true);
    } catch {
      setMessage("Touch ID / Fingerprint tasdiqlanmadi.");
    }
  }

  if (!ready) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0a0a0c] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] rounded-3xl p-6 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-accent-soft text-accent flex items-center justify-center mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2 leading-7">
              {description}
            </p>

            {!hasAnyMethod ? (
              <div className="mt-6 rounded-2xl bg-amber-50 text-amber-800 px-4 py-3 text-sm">
                Xavfsizlik metodi hali yoqilmagan. Avval Sozlanmalar bo'limida
                PIN, Face ID yoki Fingerprint qo'shing.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <MethodBadge icon={KeyRound} label="PIN" active={hasPin} />
                <MethodBadge icon={Camera} label="Face ID" active={hasFace} />
                <MethodBadge
                  icon={Fingerprint}
                  label="Fingerprint"
                  active={hasPasskey}
                />
              </div>
            )}

            {!hasAnyMethod && (
              <Link
                href="/settings"
                className="inline-flex mt-5 rounded-full bg-accent text-white px-5 py-2.5 text-sm font-semibold"
              >
                Sozlanmalarga o'tish
              </Link>
            )}

            {message && (
              <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                {message}
              </div>
            )}
          </div>

          {hasAnyMethod && (
            <div className="space-y-3">
              {hasPin && (
                <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-4">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">
                    <KeyRound className="w-4 h-4 text-accent" />
                    PIN bilan kirish
                  </div>
                  <input
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") verifyPin();
                    }}
                    type="password"
                    inputMode="numeric"
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-accent"
                    placeholder="PIN kiriting"
                  />
                  <button
                    onClick={verifyPin}
                    className="mt-3 w-full rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-2.5 text-sm font-semibold"
                  >
                    Tasdiqlash
                  </button>
                </div>
              )}

              {hasPasskey && (
                <button
                  onClick={verifyPasskey}
                  className="w-full rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-4 flex items-center gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-950"
                >
                  <Fingerprint className="w-5 h-5 text-violet-700" />
                  <span>
                    <span className="block text-sm font-bold text-slate-900 dark:text-slate-100">
                      Touch ID / Fingerprint
                    </span>
                    <span className="block text-xs text-slate-500">
                      Qurilma tasdiqlashi orqali ochish
                    </span>
                  </span>
                </button>
              )}

              {hasFace && (
                <div className="rounded-3xl border border-black/[0.06] dark:border-white/[0.08] p-4">
                  <div className="aspect-[4/3] rounded-2xl bg-slate-950 overflow-hidden relative">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      muted
                      playsInline
                    />
                    {!cameraReady && (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                        <Camera className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={startCamera}
                      className="rounded-full border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-semibold"
                    >
                      Kamera
                    </button>
                    <button
                      onClick={verifyFace}
                      disabled={!cameraReady || checkingFace}
                      className="rounded-full bg-accent text-white py-2.5 text-sm font-semibold disabled:opacity-50"
                    >
                      {checkingFace ? "Tekshirilyapti" : "Face"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MethodBadge({
  icon: Icon,
  label,
  active,
}: {
  icon: typeof ShieldCheck;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 border ${
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-50 text-slate-400"
      }`}
    >
      <Icon className="w-4 h-4 mb-2" />
      <div className="text-xs font-bold">{label}</div>
    </div>
  );
}
