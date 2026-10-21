import {
  LayoutGrid,
  BedDouble,
  CalendarClock,
  Users,
  History,
  BarChart3,
  Tag,
  BookUser,
  TrendingUp,
  ShieldCheck,
  SprayCan,
  ClipboardList,
  Search,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; shortLabel: string; icon: LucideIcon; badge?: number };
export type NavGroup = { title: string; items: NavItem[] };

type Flags = { isAdmin: boolean; canAudit: boolean; isHousekeeper: boolean; openFindings: number };

/**
 * The menu, grouped by what people do — one definition for the sidebar and the phone nav. Each item is listed
 * only for the roles that can open it; empty groups disappear.
 */
export function buildNav({ isAdmin, canAudit, isHousekeeper, openFindings }: Flags): NavGroup[] {
  const staff = !isHousekeeper;
  const groups: NavGroup[] = [
    {
      title: "งานประจำวัน",
      items: [
        { href: "/dashboard", label: "ภาพรวมรายวัน", shortLabel: "ภาพรวม", icon: LayoutGrid },
        ...(staff
          ? [
              { href: "/accommodation", label: "จองห้องพัก", shortLabel: "ห้องพัก", icon: BedDouble },
              { href: "/banquet", label: "จองห้องจัดเลี้ยง", shortLabel: "ห้องจัดเลี้ยง", icon: CalendarClock },
              { href: "/cancellations", label: "ประวัติการยกเลิก/ลบ", shortLabel: "ยกเลิก/ลบ", icon: History },
            ]
          : []),
      ],
    },
    {
      title: "งานแม่บ้าน",
      items: [
        // Housekeepers do the work here; the admin can look. Front-desk staff use the log sheet instead.
        ...(isHousekeeper || isAdmin
          ? [{ href: "/housekeeping", label: "ทำความสะอาดห้อง", shortLabel: "ทำความสะอาด", icon: SprayCan }]
          : []),
        { href: "/housekeeping-daily", label: "บัญชีคุมทำความสะอาด/เบิกวัสดุ", shortLabel: "บัญชีคุมวัสดุ", icon: ClipboardList },
      ],
    },
    {
      title: "ข้อมูลและรายงาน",
      items: staff
        ? [
            { href: "/reports", label: "รายงาน", shortLabel: "รายงาน", icon: BarChart3 },
            { href: "/sales-dashboard", label: "ยอดขายร้านอาหาร", shortLabel: "ยอดขาย", icon: TrendingUp },
            { href: "/customers", label: "ฐานข้อมูลลูกค้า", shortLabel: "ลูกค้า", icon: BookUser },
            { href: "/pricing", label: "ราคาห้องพัก/ห้องจัดเลี้ยง", shortLabel: "ราคาห้อง", icon: Tag },
          ]
        : [],
    },
    {
      title: "ตรวจสอบและผู้ดูแลระบบ",
      items: staff
        ? [
            ...(canAudit ? [{ href: "/audit", label: "ตรวจสอบภายใน", shortLabel: "ตรวจสอบภายใน", icon: Search, badge: openFindings }] : []),
            ...(canAudit ? [{ href: "/payment-log", label: "ประวัติแก้ไขการรับเงิน", shortLabel: "แก้ไขการรับเงิน", icon: ShieldCheck }] : []),
            ...(isAdmin ? [{ href: "/users", label: "จัดการผู้ใช้งาน", shortLabel: "ผู้ใช้งาน", icon: Users }] : []),
          ]
        : [],
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
