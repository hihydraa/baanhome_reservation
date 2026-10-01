import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { additionalServiceInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** Housekeeping flag: "ลูกค้าต้องการบริการเพิ่มเติม" — any logged-in role can set it. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.accommodationBooking.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบรายการจองนี้", 404);

  const body = await req.json();
  const parsed = additionalServiceInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const updated = await prisma.accommodationBooking.update({
    where: { id },
    data: { needsAdditionalService: parsed.data.needsAdditionalService },
  });

  return NextResponse.json(updated);
}
