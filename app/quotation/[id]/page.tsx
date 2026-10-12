import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { formatShortThaiDate, formatThaiDate, formatTime, todayDateOnly } from "@/lib/dates";
import { stayLine } from "@/lib/quotation-log";
import { QuotationDocument } from "@/components/quotation/QuotationDocument";
import { QuotationLogList } from "@/components/banquet/QuotationLogList";
import { extractVat, quotationTotals } from "@/lib/payment-calc";

export default async function QuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();

  const booking = await prisma.banquetBooking.findUnique({
    where: { id },
    include: {
      resource: true,
      addons: { include: { service: true } },
      linkedAccommodations: { include: { resource: true }, orderBy: { checkIn: "asc" } },
    },
  });
  if (!booking) notFound();

  // Best-effort: the customer directory isn't a hard FK, so this is a name lookup —
  // shows the buyer's own tax ID on the quotation when there's a matching record.
  const customer = await prisma.customer.findFirst({ where: { name: booking.customerName.trim() } });

  // Every price is VAT-inclusive: the room and add-ons add up to the gross total, the discount comes off
  // that, and VAT is extracted from the net (not added on top).
  const stays = booking.linkedAccommodations.flatMap((b) => {
    const line = stayLine(b);
    return line ? [{ id: b.id, description: line.name, quantity: line.quantity, unitPrice: line.price }] : [];
  });

  const { roomTotal, subtotal, discountAmount, expectedTotal: netTotal } = quotationTotals(
    booking,
    booking.resource,
    booking.addons,
    stays.map((st) => ({ nights: st.quantity, price: st.unitPrice })),
    { type: booking.discountType, value: booking.discountValue }
  );
  const { exVat, vat } = extractVat(netTotal);
  const discountValue = Number(booking.discountValue);

  const lineItems = [
    ...(roomTotal > 0
      ? [{ id: "room", description: `ค่าห้องจัดเลี้ยง ${booking.resource.name}`, quantity: 1, unitPrice: roomTotal, amount: roomTotal }]
      : []),
    ...stays.map((st) => ({ ...st, amount: st.quantity * st.unitPrice })),
    ...booking.addons.map((a) => ({
      id: a.id,
      description: a.service?.name || a.description || "-",
      quantity: a.quantity,
      unitPrice: Number(a.price),
      amount: a.quantity * Number(a.price),
    })),
  ];

  const revisionCount = await prisma.quotationLog.count({ where: { bookingId: booking.id } });

  const issueDate = formatThaiDate(todayDateOnly());

  const quotationNumber = `QT${formatShortThaiDate(booking.eventDate).replace(/-/g, "")}-${booking.id.slice(-5).toUpperCase()}`;
  const projectLine = `${formatShortThaiDate(booking.eventDate)} ${formatTime(booking.startTime)} ห้อง ${booking.resource.name} ${booking.headcount} ท่าน`;

  return (
    <QuotationDocument
      backHref={`/banquet/${booking.id}`}
      quotationNumber={quotationNumber}
      revisionCount={revisionCount}
      customerName={booking.customerName}
      phone={booking.phone}
      taxId={customer?.taxId}
      projectLine={projectLine}
      lineItems={lineItems}
      emptyHint='ยังไม่มีรายการ — เลือกห้องที่ระบุราคา หรือเพิ่ม "บริการเพิ่มเติม" ในหน้ารายละเอียดการจอง'
      subtotal={subtotal}
      discountAmount={discountAmount}
      discountType={booking.discountType}
      discountValue={discountValue}
      discountNote={booking.discountNote}
      exVat={exVat}
      vat={vat}
      netTotal={netTotal}
      preparedBy={session?.user.name ?? ""}
      issueDate={issueDate}
      log={<QuotationLogList bookingId={booking.id} />}
    />
  );
}
