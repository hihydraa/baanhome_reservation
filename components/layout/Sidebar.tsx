"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildNav, isActivePath } from "@/components/layout/nav-config";

export function Sidebar({
  isAdmin,
  canAudit,
  openFindings = 0,
  isHousekeeper,
}: {
  isAdmin: boolean;
  canAudit: boolean;
  openFindings?: number;
  isHousekeeper?: boolean;
}) {
  const pathname = usePathname();
  const groups = buildNav({ isAdmin, canAudit, isHousekeeper: !!isHousekeeper, openFindings });

  return (
    <aside className="hidden print:!hidden w-64 shrink-0 flex-col bg-forest-900 text-cream-50 md:flex">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500">
          <ChefHat className="h-5 w-5 text-forest-900" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">บ้านโฮม</p>
          <p className="text-xs text-gold-300 leading-tight">Mini MICE</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gold-300/70">{group.title}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActivePath(pathname, item.href)
                      ? "bg-gold-500 text-forest-900"
                      : "text-cream-100/80 hover:bg-forest-700 hover:text-cream-50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {item.badge ? (
                    <span className="ml-auto rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-cream-100/50 border-t border-forest-700">
        © {new Date().getFullYear()} Baan Home
      </div>
    </aside>
  );
}
