import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { housekeepingStatusInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** Any logged-in role (including housekeeping) can update a room's cleaning status. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบห้อง", 404);

  const body = await req.json();
  const parsed = housekeepingStatusInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const next = parsed.data.housekeepingStatus;
  if (next === existing.housekeepingStatus) return NextResponse.json(existing);

  // The status change and its history row commit together, so a room can't change state unrecorded.
  const [resource] = await prisma.$transaction([
    prisma.resource.update({ where: { id }, data: { housekeepingStatus: next } }),
    prisma.housekeepingLog.create({
      data: {
        resourceId: id,
        roomName: existing.name,
        fromStatus: existing.housekeepingStatus,
        toStatus: next,
        userId: session!.user.id,
        userName: session!.user.name ?? "-",
      },
    }),
  ]);

  return NextResponse.json(resource);
}
