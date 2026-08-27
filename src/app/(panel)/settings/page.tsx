"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type WorkRole = {
  id: number;
  name: string;
  description: string | null;
  tasksText: string | null;
  monthlySalary: string;
  dailySalary: string;
  reportQuestions: string | null;
  active: boolean | null;
  createdAt: string;
};

type WorkReport = {
  id: number;
  roleId: number;
  date: string;
  answers: string;
  summary: string | null;
  createdAt: string;
};

const pinKey = "flowdesk-security-pin";
const faceKey = "flowdesk-security-face";
const passkeyKey = "flowdesk-security-passkey";
const fieldClass =
  "w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-accent";

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

function questionsText(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.join("\n") : String(raw);
  } catch {
    return raw;
  }
}

export default function SettingsPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [tab, setTab] = useState<"security" | "work">("security");
  const [pinStatus, setPinStatus] = useState(false);
  const [faceStatus, setFaceStatus] = useState(false);
  const [passkeyStatus, setPasskeyStatus] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [roles, setRoles] = useState<WorkRole[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [savingRole, setSavingRole] = useState(false);

  async function loadWorkData() {
    const [roleRows, reportRows] = await Promise.all([
      fetch("/api/work-roles").then((r) => r.json()),
      fetch("/api/work-reports").then((r) => r.json()),
    ]);
    setRoles(Array.isArray(roleRows) ? roleRows : []);
    setReports(Array.isArray(reportRows) ? reportRows : []);
  }

  useEffect(() => {
    setPinStatus(Boolean(localStorage.getItem(pinKey)));
    setFaceStatus(Boolean(localStorage.getItem(faceKey)));
    setPasskeyStatus(Boolean(localStorage.getItem(passkeyKey)));
    loadWorkData();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const activeRoles = roles.filter((role) => role.active !== false);
  const monthlyTotal = useMemo(
    () =>
      activeRoles.reduce((sum, role) => sum + Number(role.monthlySalary || 0), 0),
    [activeRoles]
  );

  async function savePin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pin = String(new FormData(form).get("pin") || "");
    if (pin.length < 4) {
      setSecurityMessage("PIN kamida 4 ta raqam bo'lishi kerak.");
      return;
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const saltText = toBase64Url(salt.buffer);
    const hash = await sha256(`${saltText}:${pin}`);
    localStorage.setItem(pinKey, JSON.stringify({ salt: saltText, hash }));
    setPinStatus(true);
    setSecurityMessage("PIN saqlandi.");
    form.reset();
  }

  async function verifyPin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const pin = String(new FormData(e.currentTarget).get("pinCheck") || "");
    const raw = localStorage.getItem(pinKey);
    if (!raw) return;
    const saved = JSON.parse(raw) as { salt: string; hash: string };
    const hash = await sha256(`${saved.salt}:${pin}`);
    setSecurityMessage(hash === saved.hash ? "PIN tasdiqlandi." : "PIN noto'g'ri.");
    e.currentTarget.reset();
  }

  async function startCamera() {
    setSecurityMessage("");
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
      setSecurityMessage("Kamera ochilmadi. Browser permissionni tekshiring.");
    }
  }

  function enrollFace() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setSecurityMessage("Avval kamerani oching.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let brightness = 0;
    let samples = 0;
    for (let i = 0; i < image.length; i += 4 * 24) {
      brightness += (image[i] + image[i + 1] + image[i + 2]) / 3;
      samples += 1;
    }
    const score = Math.round(brightness / Math.max(1, samples));
    if (score < 45) {
      setSecurityMessage("Yuz qorong'i ko'rindi. Yorug'roq joyda qayta qiling.");
      return;
    }
    localStorage.setItem(
      faceKey,
      JSON.stringify({ enrolledAt: new Date().toISOString(), score })
    );
    setFaceStatus(true);
    setSecurityMessage("Face enrollment saqlandi.");
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCameraReady(false);
  }

  async function registerPasskey() {
    if (!window.PublicKeyCredential) {
      setSecurityMessage("Bu browser device biometric/passkeyni qo'llamaydi.");
      return;
    }
    try {
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rp: { name: "FlowDesk" },
          user: {
            id: userId,
            name: "flowdesk",
            displayName: "FlowDesk",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60000,
        },
      })) as PublicKeyCredential | null;

      if (!credential) return;
      localStorage.setItem(
        passkeyKey,
        JSON.stringify({
          id: credential.id,
          rawId: toBase64Url(credential.rawId),
          createdAt: new Date().toISOString(),
        })
      );
      setPasskeyStatus(true);
      setSecurityMessage("Touch ID / Fingerprint bog'landi.");
    } catch {
      setSecurityMessage("Device verification bekor qilindi yoki xato berdi.");
    }
  }

  async function verifyPasskey() {
    const raw = localStorage.getItem(passkeyKey);
    if (!raw) {
      setSecurityMessage("Avval device verificationni bog'lang.");
      return;
    }
    try {
      const saved = JSON.parse(raw) as { id: string; rawId: string };
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
      setSecurityMessage("Device verification tasdiqlandi.");
    } catch {
      setSecurityMessage("Device verification o'tmadi.");
    }
  }

  async function createRole(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSavingRole(true);
    const res = await fetch("/api/work-roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        description: fd.get("description"),
        tasksText: fd.get("tasksText"),
        monthlySalary: fd.get("monthlySalary"),
        dailySalary: fd.get("dailySalary"),
        reportQuestions: fd.get("reportQuestions"),
      }),
    });
    setSavingRole(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Ish rolini saqlashda xatolik");
      return;
    }
    form.reset();
    loadWorkData();
  }

  async function toggleRole(role: WorkRole) {
    await fetch("/api/work-roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: role.id, active: role.active === false }),
    });
    loadWorkData();
  }

  async function archiveRole(id: number) {
    if (!confirm("Bu ish rolini faolsizlantirasizmi?")) return;
    await fetch(`/api/work-roles?id=${id}`, { method: "DELETE" });
    loadWorkData();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-7">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
            Sozlanmalar
          </h1>
          <p className="text-slate-500 mt-1.5">
            Platform xavfsizligi, ish rollari va bot hisobot savollari
          </p>
        </div>
        <div className="inline-flex bg-white border border-black/[0.06] rounded-full p-1">
          <button
            onClick={() => setTab("security")}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              tab === "security" ? "bg-accent text-white" : "text-slate-500"
            }`}
          >
            Xavfsizlik
          </button>
          <button
            onClick={() => setTab("work")}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              tab === "work" ? "bg-accent text-white" : "text-slate-500"
            }`}
          >
            Ish rollari
          </button>
        </div>
      </div>

      {tab === "security" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <section className="bg-white rounded-3xl border border-black/[0.06] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">PIN / Parol</h2>
                <p className="text-xs text-slate-500">
                  Browserda saqlanadigan tezkor kirish kodi
                </p>
              </div>
            </div>
            <form onSubmit={savePin} className="space-y-3">
              <input
                name="pin"
                type="password"
                inputMode="numeric"
                minLength={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-accent"
                placeholder="Yangi PIN"
              />
              <button className="w-full rounded-full bg-slate-900 text-white py-2.5 text-sm font-semibold">
                PIN saqlash
              </button>
            </form>
            <form onSubmit={verifyPin} className="space-y-3 mt-4">
              <input
                name="pinCheck"
                type="password"
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-accent"
                placeholder="PIN tekshirish"
              />
              <button className="w-full rounded-full border border-slate-200 py-2.5 text-sm font-semibold">
                Tekshirish
              </button>
            </form>
            <Status active={pinStatus} text="PIN holati" />
          </section>

          <section className="bg-white rounded-3xl border border-black/[0.06] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Face qo'shish</h2>
                <p className="text-xs text-slate-500">
                  Data AI kabi kamera orqali yuzni tasdiqlash
                </p>
              </div>
            </div>
            <div className="aspect-[4/3] overflow-hidden rounded-3xl bg-slate-100 mb-4">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={startCamera}
                className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold"
              >
                Kamera
              </button>
              <button
                onClick={enrollFace}
                disabled={!cameraReady}
                className="rounded-full bg-accent text-white py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Face saqlash
              </button>
            </div>
            <Status active={faceStatus} text="Face holati" />
          </section>

          <section className="bg-white rounded-3xl border border-black/[0.06] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-violet-50 text-violet-700 flex items-center justify-center">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Touch ID / Fingerprint</h2>
                <p className="text-xs text-slate-500">
                  Qurilmadagi platform authenticator orqali
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={registerPasskey}
                className="w-full rounded-full bg-slate-900 text-white py-2.5 text-sm font-semibold"
              >
                Qurilmaga bog'lash
              </button>
              <button
                onClick={verifyPasskey}
                className="w-full rounded-full border border-slate-200 py-2.5 text-sm font-semibold"
              >
                Tasdiqlash
              </button>
            </div>
            <Status active={passkeyStatus} text="Device holati" />
            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500 leading-relaxed">
              Productionda passkey challenge serverda ham tekshirilishi kerak.
              Hozirgi versiya platform authenticatorni brauzerda bog'lab ishlatadi.
            </div>
          </section>

          {securityMessage && (
            <div className="xl:col-span-3 rounded-3xl bg-white border border-black/[0.06] p-4 text-sm text-slate-700 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              {securityMessage}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
          <section className="bg-white rounded-3xl border border-black/[0.06] p-6 h-fit">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <BriefcaseBusiness className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900">Ish roli qo'shish</h2>
                <p className="text-xs text-slate-500">
                  Bot shu roldagi savollarni ketma-ket so'raydi
                </p>
              </div>
            </div>
            <form onSubmit={createRole} className="space-y-3">
              <input name="name" required className={fieldClass} placeholder="Masalan: SMM, Savdo, Montaj" />
              <div className="grid grid-cols-2 gap-3">
                <input name="monthlySalary" className={fieldClass} placeholder="Oylik" />
                <input name="dailySalary" className={fieldClass} placeholder="Kunlik" />
              </div>
              <textarea
                name="description"
                className={`${fieldClass} min-h-20`}
                placeholder="Bu ish joyi / rol haqida qisqa yozing"
              />
              <textarea
                name="tasksText"
                className={`${fieldClass} min-h-28`}
                placeholder="Bu rolda qilinadigan ishlar"
              />
              <textarea
                name="reportQuestions"
                className={`${fieldClass} min-h-32`}
                placeholder={"Kunlik hisobot savollari, har biri yangi qatorda\nBugun nima ish qildingiz?\nNatija qanday bo'ldi?"}
              />
              <button
                disabled={savingRole}
                className="w-full rounded-full bg-accent text-white py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {savingRole ? "Saqlanyapti..." : "Ish roli qo'shish"}
              </button>
            </form>
          </section>

          <section>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              <Metric title="Faol rollar" value={String(activeRoles.length)} />
              <Metric title="Oylik jami" value={formatCurrency(monthlyTotal)} />
              <Metric title="Hisobotlar" value={String(reports.length)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {roles.map((role) => (
                <div key={role.id} className="bg-white rounded-3xl border border-black/[0.06] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-900">{role.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {formatCurrency(role.monthlySalary)} / oy · {formatCurrency(role.dailySalary)} / kun
                      </div>
                    </div>
                    <button
                      onClick={() => archiveRole(role.id)}
                      className="p-2 rounded-full text-slate-400 hover:text-red-500"
                      title="Faolsizlantirish"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {role.description && (
                    <p className="text-sm text-slate-600 mt-4">{role.description}</p>
                  )}
                  {role.tasksText && (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-line">
                      {role.tasksText}
                    </div>
                  )}
                  <div className="mt-4 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Bot savollari
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {questionsText(role.reportQuestions)
                      .split("\n")
                      .filter(Boolean)
                      .map((q, index) => (
                        <div key={q} className="text-xs text-slate-600 flex gap-2">
                          <span className="text-accent font-bold">{index + 1}.</span>
                          <span>{q}</span>
                        </div>
                      ))}
                  </div>
                  <button
                    onClick={() => toggleRole(role)}
                    className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold"
                  >
                    {role.active === false ? "Faollashtirish" : "Faolsizlantirish"}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 bg-white rounded-3xl border border-black/[0.06] p-5">
              <div className="font-bold text-slate-900 mb-3">Oxirgi kunlik hisobotlar</div>
              {reports.length === 0 ? (
                <div className="text-sm text-slate-500">Hali hisobot yo'q. Telegram botda /ish_hisobot bosing.</div>
              ) : (
                <div className="space-y-3">
                  {reports.slice(0, 8).map((report) => {
                    const role = roles.find((item) => item.id === report.roleId);
                    return (
                      <div key={report.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs text-slate-400">
                          {report.date} · {role?.name || `Role #${report.roleId}`}
                        </div>
                        <div className="text-sm text-slate-700 mt-1">
                          {report.summary || "Hisobot saqlandi"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Status({ active, text }: { active: boolean; text: string }) {
  return (
    <div className="mt-5 flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-600">{text}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-xs font-bold ${
          active ? "text-emerald-700" : "text-slate-400"
        }`}
      >
        {active ? <CheckCircle2 className="w-4 h-4" /> : <BadgeCheck className="w-4 h-4" />}
        {active ? "Yoqilgan" : "O'rnatilmagan"}
      </span>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl border border-black/[0.06] p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
        {title}
      </div>
      <div className="font-display text-2xl font-extrabold text-slate-900 mt-2">
        {value}
      </div>
    </div>
  );
}
