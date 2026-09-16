import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { accommodationBulkBookingInputSchema } from "@/lib/validators";
import { parseDateOnly } from "@/lib/dates";
import { findAccommodationConflict } from "@/lib/booking-conflicts";

const CHARTER_SCOPE_LABELS: Record<string, string> = {
  RESORT: "เหมารีสอร์ต",
  POOL_VILLA: "เหมาพูลวิลล่า",
  ALL: "เหมาทั้งหมด",
};

/** Charters every accommodation resource in the chosen zone (or the whole property) for one customer. */
export async function POST(req: NextRequest) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = accommodationBulkBookingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const checkIn = parseDateOnly(data.checkIn);
  const checkOut = parseDateOnly(data.checkOut);

  const resources = await prisma.resource.findMany({
    where: {
      type: "ACCOMMODATION",
      ...(data.scope === "ALL" ? {} : { zone: data.scope }),
    },
    orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
  });

  if (resources.length === 0) {
    return errorResponse("ไม่พบห้องพักในกลุ่มที่เลือก", 400);
  }

  const conflictingNames: string[] = [];
  for (const r of resources) {
    const conflict = await findAccommodationConflict({ resourceId: r.id, checkIn, checkOut });
    if (conflict) conflictingNames.push(r.name);
  }

  if (conflictingNames.length > 0) {
    return errorResponse(
      `ไม่สามารถเหมาได้ เนื่องจากห้องต่อไปนี้มีการจองซ้อนอยู่แล้ว: ${conflictingNames.join(", ")}`,
      409
    );
  }

  const scopeLabel = CHARTER_SCOPE_LABELS[data.scope] ?? data.scope;
  const anchorRoomName = resources[0].name;

  const bookings = await prisma.$transaction(
    resources.map((r, index) =>
      prisma.accommodationBooking.create({
        data: {
          resourceId: r.id,
          customerName: data.customerName,
          phone: data.phone,
          source: data.source,
          checkIn,
          checkOut,
          guestCount: data.guestCount,
          status: data.status,
          notes:
            index === 0
              ? data.notes || null
              : [data.notes, `(${scopeLabel} — ดูยอดชำระที่ห้อง ${anchorRoomName})`].filter(Boolean).join(" "),
          createdById: session!.user.id,
          payment: {
            create:
              index === 0
                ? {
                    totalAmount: data.payment.totalAmount,
                    depositAmount: data.payment.depositAmount,
                    status: data.payment.status,
                    method: data.payment.method,
                    notes: data.payment.notes,
                    paidAt: data.payment.status === "PAID" ? new Date() : null,
                  }
                : { totalAmount: 0, depositAmount: 0, status: "PAY_LATER", method: data.payment.method },
          },
        },
      })
    )
  );

  return NextResponse.json({ count: bookings.length, bookings }, { status: 201 });
}
