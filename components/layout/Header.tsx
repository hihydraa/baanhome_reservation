"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/labels";
import { buildNav, isActivePath } from "@/components/layout/nav-config";

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
  const groups = buildNav({ isAdmin, canAudit, isHousekeeper: !!isHousekeeper, openFindings });

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
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-cream-200 px-3 py-2 md:hidden">
        {groups.map((group, gi) => (
          <div key={group.title} className="flex shrink-0 items-center gap-1">
            {gi > 0 && <span className="mx-1 h-4 w-px bg-cream-200" aria-hidden />}
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                    isActivePath(pathname, item.href) ? "bg-forest-700 text-cream-50" : "bg-cream-200 text-ink-600"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.shortLabel}
                  {item.badge ? <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white">{item.badge}</span> : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </header>
  );
}
