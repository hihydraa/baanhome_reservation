import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, zodErrorResponse } from "@/lib/api-helpers";
import { paymentInputSchema } from "@/lib/validators";

type Params = { params: Promise<{ id: string }> };

/** id is the related booking's id (accommodation or banquet); the Payment is 1:1 with each. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { response } = await requireSession();
  if (response) return response;

  const { id } = await params;
  const body = await req.json();
  const parsed = paymentInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const existing = await prisma.payment.findFirst({
    where: { OR: [{ accommodationBookingId: id }, { banquetBookingId: id }] },
  });

  const isBanquet = !!(await prisma.banquetBooking.findUnique({ where: { id } }));

  const paymentData = {
    totalAmount: data.totalAmount,
    depositAmount: data.depositAmount,
    status: data.status,
    method: data.method,
    notes: data.notes,
    paidAt: data.status === "PAID" ? new Date() : null,
  };

  const payment = existing
    ? await prisma.payment.update({ where: { id: existing.id }, data: paymentData })
    : await prisma.payment.create({
        data: {
          ...paymentData,
          ...(isBanquet ? { banquetBookingId: id } : { accommodationBookingId: id }),
        },
      });

  return NextResponse.json(payment);
}
