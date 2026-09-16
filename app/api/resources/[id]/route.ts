import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { resourcePricingInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** Staff/admin can update a room's pricing fields — never its name, zone, type, or sort order. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const existing = await prisma.resource.findUnique({ where: { id } });
  if (!existing) return errorResponse("ไม่พบห้อง", 404);

  const body = await req.json();
  const parsed = resourcePricingInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const resource = await prisma.resource.update({
    where: { id },
    data,
  });

  return NextResponse.json(resource);
}
