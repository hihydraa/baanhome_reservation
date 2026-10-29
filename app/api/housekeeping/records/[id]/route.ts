import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { cleaningRecordUpdateSchema } from "@/lib/validators";
import { parseDateOnly, todayDateOnly } from "@/lib/dates";
import { TRACKED_KEYS } from "@/lib/housekeeping";
import { syncHousekeepingBilling } from "@/lib/housekeeping-billing";

type Params = { params: Promise<{ id: string }> };

/**
 * Any logged-in role (including housekeeping) can correct any cleaning record — room, type, date,
 * supplies, notes. The record keeps who edited it last and when.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.cleaningRecord.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบบันทึก", 404);

  const parsed = cleaningRecordUpdateSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const room = await prisma.resource.findUnique({ where: { id: data.resourceId } });
  if (!room || room.type !== "ACCOMMODATION") return errorResponse("ไม่พบห้อง", 404);

  const serviceDate = data.serviceDate ? parseDateOnly(data.serviceDate) : existing.serviceDate;
  if (serviceDate > todayDateOnly()) return errorResponse("เลือกวันที่หลังวันนี้ไม่ได้", 400);
  const ledgerDate = data.ledgerDate ? parseDateOnly(data.ledgerDate) : existing.ledgerDate;
  if (ledgerDate > todayDateOnly()) return errorResponse("เลือกวันที่ลงบัญชีหลังวันนี้ไม่ได้", 400);

  // Replace the items and update the record together so a failed edit never leaves a half-edited record.
  const record = await prisma.$transaction(async (tx) => {
    await tx.cleaningRecordItem.deleteMany({ where: { recordId: id } });
    const updated = await tx.cleaningRecord.update({
      where: { id },
      data: {
        resourceId: room.id,
        roomName: room.name,
        type: data.type,
        serviceDate,
        ledgerDate,
        notes: data.notes || null,
        repairNote: data.repairNote || null,
        editedByName: session!.user.name ?? "-",
        editedAt: new Date(),
        items: {
          create: data.items.map((i) => ({
            name: i.name,
            category: i.category && TRACKED_KEYS.includes(i.category) ? i.category : null,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    });
    // The hours may now belong to a different room or stay, so settle both the old and the new one.
    await syncHousekeepingBilling(tx, existing.resourceId, existing.ledgerDate);
    if (room.id !== existing.resourceId || ledgerDate.getTime() !== existing.ledgerDate.getTime()) {
      await syncHousekeepingBilling(tx, room.id, ledgerDate);
    }
    return updated;
  });

  return NextResponse.json(record);
}
