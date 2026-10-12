import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatShortThaiDate, formatThaiDate, todayDateOnly } from "@/lib/dates";
import { accommodationExpectedTotal, extractVat } from "@/lib/payment-calc";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import { QuotationLogList } from "@/components/banquet/QuotationLogList";

export default async function AccommodationQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();

  const booking = await prisma.accommodationBooking.findUnique({
    where: { id },
    include: { resource: true, addons: { include: { service: true } } },
  });
  if (!booking) notFound();

  // Best-effort name lookup (the customer directory isn't a hard FK) for the buyer's tax ID.
  const customer = await prisma.customer.findFirst({ where: { name: booking.customerName.trim() } });

  // Every price is VAT-inclusive: room + add-ons = gross total, discount comes off, VAT is extracted from the net.
  const { nights, subtotal, discountAmount, expectedTotal: netTotal } = accommodationExpectedTotal(booking, booking.addons);
  const { exVat, vat } = extractVat(netTotal);

  const roomPrice = booking.roomPrice == null ? 0 : Number(booking.roomPrice);
  const lineItems = [
    {
      id: "room",
      description: `ค่าห้องพัก ${booking.resource.name} (${formatThaiDate(booking.checkIn)} - ${formatThaiDate(booking.checkOut)})`,
      quantity: nights,
      unitPrice: roomPrice,
      amount: nights * roomPrice,
    },
    ...booking.addons.map((a) => ({
      id: a.id,
      description: a.service?.name || a.description || "-",
      quantity: a.quantity,
      unitPrice: Number(a.price),
      amount: a.quantity * Number(a.price),
    })),
  ];

  const revisionCount = await prisma.quotationLog.count({ where: { accommodationBookingId: booking.id } });
  const quotationNumber = `QT${formatShortThaiDate(booking.checkIn).replace(/-/g, "")}-${booking.id.slice(-5).toUpperCase()}`;
  const projectLine = `${formatShortThaiDate(booking.checkIn)} ถึง ${formatShortThaiDate(booking.checkOut)} ห้อง ${booking.resource.name} ${booking.guestCount} ท่าน ${nights} คืน`;

  return (
    <QuotationDocument
      backHref={`/accommodation/${booking.id}`}
      quotationNumber={quotationNumber}
      revisionCount={revisionCount}
      customerName={booking.customerName}
      phone={booking.phone}
      taxId={customer?.taxId}
      projectLine={projectLine}
      lineItems={lineItems}
      emptyHint="ยังไม่มีรายการ"
      subtotal={subtotal}
      discountAmount={discountAmount}
      discountType={booking.discountType}
      discountValue={Number(booking.discountValue)}
      discountNote={booking.discountNote}
      exVat={exVat}
      vat={vat}
      netTotal={netTotal}
      preparedBy={session?.user.name ?? ""}
      issueDate={formatThaiDate(todayDateOnly())}
      log={<QuotationLogList accommodationBookingId={booking.id} />}
    />
  );
}
