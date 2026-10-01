import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { quickAddonInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** Lets any logged-in role (incl. housekeeping) attach a service from the catalog to a
 *  booking without seeing or setting its price — the price comes from SpecialService. */
export async function POST(req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const booking = await prisma.accommodationBooking.findUnique({ where: { id } });
  if (!booking) return errorResponse("ไม่พบรายการจองนี้", 404);

  const body = await req.json();
  const parsed = quickAddonInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const service = await prisma.specialService.findUnique({ where: { id: parsed.data.serviceId } });
  if (!service || service.scope !== "ACCOMMODATION") return errorResponse("ไม่พบบริการนี้", 404);

  const addon = await prisma.accommodationAddon.create({
    data: {
      bookingId: id,
      serviceId: service.id,
      quantity: parsed.data.quantity,
      price: service.price,
    },
    include: { service: true },
  });

  return NextResponse.json({ id: addon.id, quantity: addon.quantity, serviceName: addon.service?.name ?? null });
}
