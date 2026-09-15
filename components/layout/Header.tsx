"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, LayoutGrid, BedDouble, CalendarClock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "ภาพรวม", icon: LayoutGrid },
  { href: "/accommodation", label: "ห้องพัก", icon: BedDouble },
  { href: "/banquet", label: "ห้องจัดเลี้ยง", icon: CalendarClock },
];

export function Header({
  name,
  role,
  isAdmin,
}: {
  name: string;
  role: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-cream-200 bg-cream-50/95 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 md:px-6">
        <div className="md:hidden font-semibold text-forest-800">บ้านโฮม Mini MICE</div>
        <div className="hidden md:block text-sm text-ink-600">
          ระบบจองห้องพักและห้องจัดเลี้ยง — ภายในทีมงาน
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium text-ink-900">{name}</p>
            <p className="text-xs text-ink-400">{role === "ADMIN" ? "ผู้ดูแลระบบ" : "พนักงาน"}</p>
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
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
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
        {isAdmin && (
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
      </nav>
    </header>
  );
}
