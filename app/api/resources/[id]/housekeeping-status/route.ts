import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { housekeepingStatusInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** Any logged-in role (including housekeeping) can update a room's cleaning status. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบห้อง", 404);

  const body = await req.json();
  const parsed = housekeepingStatusInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const resource = await prisma.resource.update({
    where: { id },
    data: { housekeepingStatus: parsed.data.housekeepingStatus },
  });

  return NextResponse.json(resource);
}
