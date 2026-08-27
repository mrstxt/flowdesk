"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  Plus,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatDateDisplay, todayISO } from "@/lib/utils";

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

const fieldClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-accent";

function questions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {}
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAnswers(raw: string): { question: string; answer: string }[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => ({
          question: String(item.question || "Savol"),
          answer: String(item.answer || ""),
        }))
        .filter((item) => item.answer);
    }
  } catch {}
  return [];
}

export default function WorkRolesPage() {
  const [roles, setRoles] = useState<WorkRole[]>([]);
  const [reports, setReports] = useState<WorkReport[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [roleRows, reportRows] = await Promise.all([
      fetch("/api/work-roles").then((r) => r.json()),
      fetch("/api/work-reports").then((r) => r.json()),
    ]);
    setRoles(Array.isArray(roleRows) ? roleRows : []);
    setReports(Array.isArray(reportRows) ? reportRows : []);
  }

  useEffect(() => {
    load();
  }, []);

  const activeRoles = roles.filter((role) => role.active !== false);
  const monthlyTotal = useMemo(
    () =>
      activeRoles.reduce(
        (sum, role) => sum + Number(role.monthlySalary || 0),
        0
      ),
    [activeRoles]
  );
  const dailyTotal = useMemo(
    () =>
      activeRoles.reduce((sum, role) => sum + Number(role.dailySalary || 0), 0),
    [activeRoles]
  );
  const reportCountByRole = useMemo(() => {
    const map = new Map<number, number>();
    for (const report of reports) {
      map.set(report.roleId, (map.get(report.roleId) || 0) + 1);
    }
    return map;
  }, [reports]);
  const today = todayISO();
  const todayReports = reports.filter((report) => report.date === today);

  async function createRole(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setSaving(true);
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
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Ish rolini saqlashda xatolik");
      return;
    }
    form.reset();
    load();
  }

  async function toggleRole(role: WorkRole) {
    await fetch("/api/work-roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: role.id, active: role.active === false }),
    });
    load();
  }

  async function archiveRole(id: number) {
    if (!confirm("Bu ish rolini faolsizlantirasizmi?")) return;
    await fetch(`/api/work-roles?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-7">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900">
            Ish rollari
          </h1>
          <p className="text-slate-500 mt-1.5">
            Har bir ishda nima qilinadi, qanday natija olinadi va kunlik hisobotlar
          </p>
        </div>
        <div className="rounded-3xl bg-slate-900 text-white px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-white/55">Telegram bot</div>
            <div className="font-semibold">/ish_hisobot</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Metric icon={BriefcaseBusiness} title="Faol rollar" value={String(activeRoles.length)} />
        <Metric icon={BarChart3} title="Oylik jami" value={formatCurrency(monthlyTotal)} />
        <Metric icon={ClipboardList} title="Kunlik jami" value={formatCurrency(dailyTotal)} />
        <Metric icon={MessageSquareText} title="Bugungi hisobot" value={`${todayReports.length}/${activeRoles.length}`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[410px_1fr] gap-5">
        <section className="bg-white rounded-3xl border border-black/[0.06] p-6 h-fit">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900">Yangi ish roli</h2>
              <p className="text-xs text-slate-500">
                Vazifa, ish uslubi va natija savollarini kiriting
              </p>
            </div>
          </div>
          <form onSubmit={createRole} className="space-y-3">
            <input
              name="name"
              required
              className={fieldClass}
              placeholder="Masalan: SMM, Savdo, Montaj"
            />
            <div className="grid grid-cols-2 gap-3">
              <input name="monthlySalary" className={fieldClass} placeholder="Oylik" />
              <input name="dailySalary" className={fieldClass} placeholder="Kunlik" />
            </div>
            <textarea
              name="description"
              className={`${fieldClass} min-h-20`}
              placeholder="Bu rolda nima maqsad bor va qaysi natija kutiladi?"
            />
            <textarea
              name="tasksText"
              className={`${fieldClass} min-h-32`}
              placeholder={"Nima qilishlar kerak\nKontent reja tuzish\nMijozlarga javob berish\nNatijani raqam bilan yozish"}
            />
            <textarea
              name="reportQuestions"
              className={`${fieldClass} min-h-36`}
              placeholder={"Kunlik hisobot va natija savollari\nBugun nima ish qildingiz?\nQanday natija chiqdi?\nQaysi raqam o'sdi?\nErtaga nima qilasiz?"}
            />
            <button
              disabled={saving}
              className="w-full rounded-full bg-accent text-white py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {saving ? "Saqlanyapti..." : "Rol qo'shish"}
            </button>
          </form>
        </section>

        <section>
          {roles.length === 0 ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
              <BriefcaseBusiness className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <div className="font-semibold text-slate-800">Ish roli hali yo'q</div>
              <div className="text-sm text-slate-500 mt-1">
                Chapdagi forma orqali birinchi ish kategoriyangizni qo'shing.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {roles.map((role) => {
                const active = role.active !== false;
                const roleQuestions = questions(role.reportQuestions);
                const roleReports = reports.filter(
                  (report) => report.roleId === role.id
                );
                const latestReport = roleReports[0];
                const reportedToday = roleReports.some(
                  (report) => report.date === today
                );
                return (
                  <article
                    key={role.id}
                    className={`bg-white rounded-3xl border p-5 ${
                      active ? "border-black/[0.06]" : "border-slate-200 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 truncate">
                            {role.name}
                          </h3>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              active
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {active ? "Faol" : "Faol emas"}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              reportedToday
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {reportedToday ? "Bugun topshirildi" : "Hisobot kutilmoqda"}
                          </span>
                        </div>
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
                      <p className="text-sm text-slate-600 mt-4 leading-relaxed">
                        {role.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <MiniStat title="Savollar" value={String(roleQuestions.length)} />
                      <MiniStat
                        title="Jami hisobot"
                        value={String(reportCountByRole.get(role.id) || 0)}
                      />
                    </div>

                    {role.tasksText && (
                      <div className="mt-4">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                          Qilinadigan ishlar
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                          {role.tasksText}
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        Kunlik natija
                      </div>
                      <div className="rounded-2xl bg-blue-50/70 p-3 text-xs text-blue-900 leading-relaxed">
                        {latestReport
                          ? `${formatDateDisplay(latestReport.date)}: ${
                              latestReport.summary || "Hisobot saqlandi"
                            }`
                          : "Hali natija yo'q. Botda /ish_hisobot yuborilganda shu yer to'lib boradi."}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                        Bot savollari
                      </div>
                      <div className="space-y-1.5">
                        {roleQuestions.map((question, index) => (
                          <div
                            key={`${role.id}-${question}`}
                            className="text-xs text-slate-600 flex gap-2"
                          >
                            <span className="text-accent font-bold">{index + 1}.</span>
                            <span>{question}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleRole(role)}
                      className="mt-5 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold flex items-center gap-2"
                    >
                      {active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                      {active ? "Faolsizlantirish" : "Faollashtirish"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-5 bg-white rounded-3xl border border-black/[0.06] p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <div className="font-bold text-slate-900">Oxirgi hisobotlar</div>
                <div className="text-xs text-slate-500 mt-1">
                  Botdan kelgan javoblar role bo'yicha saqlanadi
                </div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            {reports.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                Hali hisobot yo'q. Telegram botda /ish_hisobot bosing.
              </div>
            ) : (
              <div className="space-y-3">
                {reports.slice(0, 10).map((report) => {
                  const role = roles.find((item) => item.id === report.roleId);
                  const answers = parseAnswers(report.answers);
                  return (
                    <div key={report.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs text-slate-400">
                          {formatDateDisplay(report.date)} · {role?.name || `Role #${report.roleId}`}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {answers.length} javob
                        </span>
                      </div>
                      <div className="mt-2 space-y-2">
                        {answers.length ? (
                          answers.slice(0, 4).map((item) => (
                            <div key={`${report.id}-${item.question}`} className="text-sm">
                              <div className="text-xs text-slate-400">{item.question}</div>
                              <div className="text-slate-700">{item.answer}</div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-slate-700">
                            {report.summary || "Hisobot saqlandi"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  title,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-black/[0.06] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
            {title}
          </div>
          <div className="font-display text-2xl font-extrabold text-slate-900 mt-2">
            {value}
          </div>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-600 flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <div className="text-[11px] text-slate-400">{title}</div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}
