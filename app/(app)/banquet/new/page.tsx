import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { BanquetForm } from "@/components/banquet/BanquetForm";
import { formatThaiDate } from "@/lib/dates";

export default async function NewBanquetBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ resourceId?: string; date?: string }>;
}) {
  const { resourceId, date } = await searchParams;

  const [resources, accommodationBookings] = await Promise.all([
    prisma.resource.findMany({ where: { type: "BANQUET" }, orderBy: [{ sortOrder: "asc" }] }),
    prisma.accommodationBooking.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { resource: true },
      orderBy: { checkIn: "desc" },
      take: 50,
    }),
  ]);

  const accommodationOptions = accommodationBookings.map((b) => ({
    id: b.id,
    label: `${b.customerName} — ${b.resource.name} (${formatThaiDate(b.checkIn)})`,
  }));

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link href="/banquet" className="inline-flex items-center gap-1.5 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        กลับไปตารางห้องจัดเลี้ยง
      </Link>

      <h1 className="text-xl font-semibold text-forest-800">จองห้องจัดเลี้ยงใหม่</h1>

      <BanquetForm
        resources={resources}
        accommodationOptions={accommodationOptions}
        initialOverrides={{
          ...(resourceId ? { resourceId } : {}),
          ...(date ? { eventDate: date } : {}),
        }}
      />
    </div>
  );
}
