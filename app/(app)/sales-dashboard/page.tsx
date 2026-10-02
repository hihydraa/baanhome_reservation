import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function SalesDashboardPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") {
    redirect("/dashboard");
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">Dashboard ยอดขายร้านอาหาร</h1>
        <p className="text-sm text-ink-600">
          ข้อมูลสดจาก Google Sheet (POS export) แยกยอดร้านอาหารออกจากยอดที่พักให้อัตโนมัติ
        </p>
      </div>
      <iframe
        src="/sales-dashboard/index.html"
        title="Dashboard ยอดขายร้านอาหาร"
        className="h-[calc(100vh-10rem)] min-h-[600px] w-full rounded-lg border border-cream-200 bg-white shadow-sm"
      />
    </div>
  );
}
