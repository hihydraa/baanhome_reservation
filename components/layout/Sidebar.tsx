"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BedDouble, CalendarClock, Users, ChefHat, History, Sparkles, BarChart3, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ภาพรวมรายวัน", icon: LayoutGrid },
  { href: "/accommodation", label: "จองห้องพัก", icon: BedDouble },
  { href: "/banquet", label: "จองห้องจัดเลี้ยง", icon: CalendarClock },
  { href: "/cancellations", label: "ประวัติการยกเลิก", icon: History },
];

export function Sidebar({ isAdmin, isHousekeeper }: { isAdmin: boolean; isHousekeeper?: boolean }) {
  const pathname = usePathname();
  const navItems = isHousekeeper ? NAV_ITEMS.filter((item) => item.href === "/dashboard") : NAV_ITEMS;

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-forest-900 text-cream-50 md:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500">
          <ChefHat className="h-5 w-5 text-forest-900" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">บ้านโฮม</p>
          <p className="text-xs text-gold-300 leading-tight">Mini MICE</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-gold-500 text-forest-900"
                  : "text-cream-100/80 hover:bg-forest-700 hover:text-cream-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {!isHousekeeper && (
          <>
            <Link
              href="/pricing"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/pricing")
                  ? "bg-gold-500 text-forest-900"
                  : "text-cream-100/80 hover:bg-forest-700 hover:text-cream-50"
              )}
            >
              <Tag className="h-4 w-4" />
              ราคาห้องพัก/ห้องจัดเลี้ยง
            </Link>
            <Link
              href="/special-services"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/special-services")
                  ? "bg-gold-500 text-forest-900"
                  : "text-cream-100/80 hover:bg-forest-700 hover:text-cream-50"
              )}
            >
              <Sparkles className="h-4 w-4" />
              บริการพิเศษ
            </Link>
            <Link
              href="/reports"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/reports")
                  ? "bg-gold-500 text-forest-900"
                  : "text-cream-100/80 hover:bg-forest-700 hover:text-cream-50"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              รายงาน
            </Link>
          </>
        )}

        {isAdmin && (
          <>
            <Link
              href="/users"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname.startsWith("/users")
                  ? "bg-gold-500 text-forest-900"
                  : "text-cream-100/80 hover:bg-forest-700 hover:text-cream-50"
              )}
            >
              <Users className="h-4 w-4" />
              จัดการผู้ใช้งาน
            </Link>
          </>
        )}
      </nav>

      <div className="px-5 py-4 text-xs text-cream-100/50 border-t border-forest-700">
        © {new Date().getFullYear()} Baan Home
      </div>
    </aside>
  );
}
