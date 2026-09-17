import { BedDouble, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SummaryItem = {
  label: string;
  count: number;
  percent?: number;
  icon: LucideIcon;
  iconClassName: string;
};

export function DailySummaryCards({
  total,
  checkedIn,
  reserved,
  checkedOut,
  cancelled,
}: {
  total: number;
  checkedIn: number;
  reserved: number;
  checkedOut: number;
  cancelled: number;
}) {
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const items: SummaryItem[] = [
    { label: "ทั้งหมด", count: total, icon: BedDouble, iconClassName: "bg-gold-100 text-gold-600" },
    {
      label: "เข้าพักแล้ว",
      count: checkedIn,
      percent: pct(checkedIn),
      icon: CheckCircle2,
      iconClassName: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "จอง (รอเข้าพัก)",
      count: reserved,
      percent: pct(reserved),
      icon: Clock,
      iconClassName: "bg-amber-100 text-amber-600",
    },
    {
      label: "เช็คเอาท์แล้ว",
      count: checkedOut,
      percent: pct(checkedOut),
      icon: CheckCircle2,
      iconClassName: "bg-cream-200 text-ink-500",
    },
    {
      label: "ยกเลิก",
      count: cancelled,
      percent: pct(cancelled),
      icon: XCircle,
      iconClassName: "bg-red-100 text-red-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-lg border border-cream-200 bg-white p-3 shadow-sm"
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", item.iconClassName)}>
            <item.icon className="h-5 w-5" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs text-ink-400">{item.label}</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold text-ink-900">{item.count} ห้อง</span>
              {item.percent != null && <span className="text-xs text-ink-400">{item.percent}%</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
