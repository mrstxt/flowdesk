"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Calendar, GripVertical, Trash2 } from "lucide-react";
import { formatCurrency, parseMoneyInput } from "@/lib/utils";
import { Modal } from "@/components/Modal";

type Order = {
  id: number;
  title: string;
  description: string | null;
  stage: string;
  amount: string;
  deadline: string | null;
  clientName: string | null;
  paymentType: string;
  archived: boolean | null;
};

const STAGES = [
  { id: "new", label: "Yangi", color: "bg-[#8e8e93]" },
  { id: "in_progress", label: "Jarayonda", color: "bg-[#0a84ff]" },
  { id: "review", label: "Tekshiruvda", color: "bg-[#ff9f0a]" },
  { id: "confirmed", label: "Tasdiqlandi", color: "bg-[#34c759]" },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState(false);
  const [payModal, setPayModal] = useState<Order | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  async function load() {
    const rows = await fetch("/api/orders").then((r) => r.json());
    setOrders(rows);
  }

  useEffect(() => {
    load();
  }, []);
  
  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    // 1. Sudralayotgan buyurtmani topish
    const order = orders.find((o) => o.id === active.id);
    if (!order) return;

    // 2. Yangi bosqichni aniqlash
    let newStage: string | null = null;

    // over element - bu OrderCard yoki StageColumn bo'lishi mumkin
    const overId = over.id;
    
    // Birinchi navbatda over.data dan stage ni olishga harakat qilamiz
    if (over.data.current?.stage) {
      newStage = over.data.current.stage;
    } else {
      // over.id stage ID si bo'lishi mumkin
      const isStage = STAGES.some(s => s.id === overId);
      if (isStage) {
        newStage = overId as string;
      } else {
        // over - bu OrderCard bo'lsa, uning stage'ini olamiz
        const targetOrder = orders.find((o) => o.id === overId);
        if (targetOrder) {
          newStage = targetOrder.stage;
        }
      }
    }

    if (!newStage || order.stage === newStage) return;

    // If moving to confirmed, ask about payment
    if (newStage === "confirmed" && order.stage !== "confirmed") {
      setPayModal({ ...order, stage: newStage });
      return;
    }

    // 3. Bosqichni yangilash
    await updateStage(order, newStage, order.paymentType);
  }

  async function updateStage(
    order: Order,
    stage: string,
    paymentType: string
  ) {
    const oldStage = order.stage;
    const optimistic = orders.map((o) =>
      o.id === order.id
        ? {
            ...o,
            stage,
            paymentType,
            archived: stage === "confirmed" ? true : o.archived,
          }
        : o
    );
    setOrders(optimistic);

    await fetch("/api/orders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: order.id,
        stage,
        paymentType,
        title: order.title,
        amount: order.amount,
        _oldStage: oldStage,
      }),
    });
    load();
  }

  async function confirmPayment(paymentType: string) {
    if (!payModal) return;
    await updateStage(payModal, payModal.stage, paymentType);
    setPayModal(null);
  }

  async function createOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        description: fd.get("description") || null,
        amount: String(parseMoneyInput(fd.get("amount"))),
        deadline: fd.get("deadline") || null,
        clientName: fd.get("clientName") || null,
      }),
    });
    setModal(false);
    e.currentTarget.reset();
    load();
  }

  async function deleteOrder(id: number) {
    if (!confirm("Buyurtmani o'chirmoqchimisiz?")) return;
    await fetch(`/api/orders?id=${id}`, { method: "DELETE" });
    load();
  }

  const visibleOrders = showArchived
    ? orders
    : orders.filter((o) => !o.archived);

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Buyurtmalar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Kanban taxtasi — kartochkalarni sudrab o'tkazing
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {showArchived ? "Arxivni yashir" : "Arxivni ko'rsat"}
          </button>
          <button
            onClick={() => setModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4" /> Yangi buyurtma
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const stageOrders = visibleOrders.filter(
              (o) => o.stage === stage.id
            );
            const total = stageOrders.reduce(
              (s, o) => s + parseMoneyInput(o.amount),
              0
            );
            return (
              <StageColumn
                key={stage.id}
                stage={stage}
                orders={stageOrders}
                total={total}
                onDelete={deleteOrder}
              />
            );
          })}
        </div>
      </DndContext>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Yangi buyurtma"
      >
        <form onSubmit={createOrder} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Nomi
            </label>
            <input
              name="title"
              required
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              placeholder="Masalan: Logo dizayn"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Mijoz
            </label>
            <input
              name="clientName"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Summa (so'm)
              </label>
              <input
                name="amount"
                type="text"
                inputMode="decimal"
                defaultValue="0"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Deadline
              </label>
              <input
                name="deadline"
                type="date"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Tavsif
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModal(false)}
              className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
            >
              Bekor
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-accent text-white rounded-full hover:bg-accent-hover"
            >
              Yaratish
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="To'lov turi"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Buyurtma tasdiqlandi. To'lov qanday amalga oshirildi?
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => confirmPayment("cash")}
              className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-accent transition-colors text-left"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Naqd
              </div>
              <div className="text-xs text-slate-500 mt-1">Qo'lda olindi</div>
            </button>
            <button
              onClick={() => confirmPayment("card")}
              className="p-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:border-accent transition-colors text-left"
            >
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Plastik
              </div>
              <div className="text-xs text-slate-500 mt-1">Karta orqali</div>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StageColumn({
  stage,
  orders,
  total,
  onDelete,
}: {
  stage: { id: string; label: string; color: string };
  orders: Order[];
  total: number;
  onDelete: (id: number) => void;
}) {
  return (
    <div
      className="bg-slate-100 dark:bg-slate-900 rounded-3xl p-3 min-h-[300px]"
      id={stage.id}
      data-stage={stage.id} // <-- MUHIM: Bu qator qo'shildi
    >
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.color}`} />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {stage.label}
          </h3>
          <span className="text-xs text-slate-500 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {orders.length}
          </span>
        </div>
      </div>
      {total > 0 && (
        <div className="px-2 pb-2 text-xs text-slate-500">
          Jami: {formatCurrency(total)}
        </div>
      )}
      <SortableContext
        id={stage.id}
        items={orders.map((o) => o.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onDelete={onDelete} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function OrderCard({
  order,
  onDelete,
}: {
  order: Order;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: order.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 group"
    >
      <div className="flex items-start justify-between gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -m-1 text-slate-300 dark:text-slate-600 hover:text-slate-500"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(order.id)}
          className="opacity-0 group-hover:opacity-100 p-1 -m-1 text-slate-400 hover:text-red-500 transition-opacity"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-1">
        <div className="font-medium text-sm text-slate-900 dark:text-slate-100 mb-1">
          {order.title}
        </div>
        {order.clientName && (
          <div className="text-xs text-slate-500 mb-2">
            Mijoz: {order.clientName}
          </div>
        )}
        {order.description && (
          <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
            {order.description}
          </p>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700">
          {order.deadline ? (
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Calendar className="w-3 h-3" />
              {order.deadline}
            </div>
          ) : (
            <div />
          )}
          <div className="text-sm font-semibold text-accent">
            {formatCurrency(order.amount)}
          </div>
        </div>
      </div>
    </div>
  );
}