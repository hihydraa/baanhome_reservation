"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, LayoutGrid, BedDouble, CalendarClock, Users, History, BarChart3, Tag, BookUser, ShieldCheck, SprayCan, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/labels";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutGrid },
  { href: "/housekeeping", label: "ทำความสะอาด", icon: SprayCan },
  { href: "/housekeeping-daily", label: "บัญชีคุมวัสดุ", icon: ClipboardList },
  { href: "/accommodation", label: "ห้องพัก", icon: BedDouble },
  { href: "/banquet", label: "ห้องจัดเลี้ยง", icon: CalendarClock },
  { href: "/cancellations", label: "ยกเลิก/ลบ", icon: History },
  { href: "/pricing", label: "ราคาห้อง", icon: Tag },
  { href: "/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/customers", label: "ลูกค้า", icon: BookUser },
];

export function Header({
  name,
  role,
  isAdmin,
  canAudit,
  openFindings = 0,
  isHousekeeper,
}: {
  name: string;
  role: string;
  isAdmin: boolean;
  canAudit: boolean;
  openFindings?: number;
  isHousekeeper?: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="print:hidden sticky top-0 z-40 border-b border-cream-200 bg-cream-50/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="md:hidden font-semibold text-forest-800">บ้านโฮม Mini MICE</div>
        <div className="hidden md:block text-sm text-ink-600">
          ระบบจองห้องพักและห้องจัดเลี้ยง — ภายในทีมงาน
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-ink-900">{name}</p>
            <p className="text-xs text-ink-400">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => signOut({ callbackUrl: "/login" })}
            title="ออกจากระบบ"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    <nav className="flex gap-1 overflow-x-auto border-t border-cream-200 px-3 py-2 md:hidden">
        {(isHousekeeper ? MOBILE_NAV_ITEMS.slice(0, 3) : MOBILE_NAV_ITEMS.filter((item) => isAdmin || item.href !== "/housekeeping")).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                active ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
        {!isHousekeeper && canAudit && (
          <Link
            href="/housekeeping-log"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              pathname.startsWith("/housekeeping-log") ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600"
            )}
          >
            <SprayCan className="h-3.5 w-3.5" />
            บันทึกทำห้อง
            {openFindings > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{openFindings}</span>}
          </Link>
        )}
        {!isHousekeeper && isAdmin && (
          <Link
            href="/users"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              pathname.startsWith("/users") ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            ผู้ใช้งาน
          </Link>
        )}
        {!isHousekeeper && canAudit && (
          <Link
            href="/payment-log"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
              pathname.startsWith("/payment-log") ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600"
            )}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            แก้ไขการรับเงิน
          </Link>
        )}
      </nav>
    </header>
  );
}
