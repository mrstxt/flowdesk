import { Sidebar } from "@/components/Sidebar";
import { SecurityGate } from "@/components/SecurityGate";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SecurityGate
      scope="app"
      title="FlowDesk himoyalangan"
      description="Platformga kirish uchun Sozlanmalarda yoqilgan PIN, Face ID yoki qurilma Fingerprint tasdiqlashidan foydalaning."
    >
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 min-w-0 bg-[#fbfbfd] dark:bg-[#0a0a0c]">
          {/* Ambient layered background */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full bg-accent/[0.055] blur-3xl" />
            <div className="absolute top-1/2 -left-48 w-[440px] h-[440px] rounded-full bg-[#0a84ff]/[0.05] blur-3xl" />
            <div className="absolute bottom-0 right-1/3 w-[360px] h-[360px] rounded-full bg-[#ff9f0a]/[0.04] blur-3xl" />
          </div>
          <div className="relative">{children}</div>
        </main>
      </div>
    </SecurityGate>
  );
}
