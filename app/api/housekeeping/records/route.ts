import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { cleaningRecordInputSchema } from "@/lib/validators";
import { todayDateOnly } from "@/lib/dates";
import { TRACKED_KEYS } from "@/lib/housekeeping";

/**
 * Any logged-in role (including housekeeping) records a room cleaning and the supplies taken out.
 * A post-checkout cleaning also marks the room ready for sale, with a status-history row.
 */
export async function POST(req: NextRequest) {
  const { session, response } = await requireSession();
  if (response) return response;

  const body = await req.json();
  const parsed = cleaningRecordInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const room = await prisma.resource.findUnique({ where: { id: data.resourceId } });
  if (!room || room.type !== "ACCOMMODATION") return errorResponse("ไม่พบห้อง", 404);

  const userName = session!.user.name ?? "-";
  const markReady = data.type === "CHECKOUT" && room.housekeepingStatus === "NEEDS_CLEANING";

  // The cleaning record, its items and the room's status change commit together.
  const [record] = await prisma.$transaction([
    prisma.cleaningRecord.create({
      data: {
        resourceId: room.id,
        roomName: room.name,
        type: data.type,
        serviceDate: todayDateOnly(),
        notes: data.notes || null,
        userId: session!.user.id,
        userName,
        items: {
          create: data.items.map((i) => ({
            name: i.name,
            category: i.category && TRACKED_KEYS.includes(i.category) ? i.category : null,
            quantity: i.quantity,
          })),
        },
      },
      include: { items: true },
    }),
    ...(markReady
      ? [
          prisma.resource.update({ where: { id: room.id }, data: { housekeepingStatus: "READY" } }),
          prisma.housekeepingLog.create({
            data: {
              resourceId: room.id,
              roomName: room.name,
              fromStatus: room.housekeepingStatus,
              toStatus: "READY",
              userId: session!.user.id,
              userName,
            },
          }),
        ]
      : []),
  ]);

  return NextResponse.json(record, { status: 201 });
}
