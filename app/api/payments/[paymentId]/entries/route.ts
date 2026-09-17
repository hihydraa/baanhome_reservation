import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { paymentEntryInputSchema } from "@/lib/validators";
import { combineDateWithNowTime } from "@/lib/dates";
import { generateReceiptNumber } from "@/lib/receipt";

type Params = { params: Promise<{ paymentId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { paymentId } = await params;
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return errorResponse("ไม่พบข้อมูลการชำระเงิน", 404);

  const body = await req.json();
  const parsed = paymentEntryInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const paidAt = combineDateWithNowTime(data.paidAt);

  // Receipt numbers are a per-day sequence; retry once if a concurrent submission raced us to it.
  for (let attempt = 0; attempt < 2; attempt++) {
    const receiptNumber = await generateReceiptNumber(prisma, paidAt);
    try {
      const entry = await prisma.paymentEntry.create({
        data: {
          paymentId,
          amount: data.amount,
          method: data.method,
          paidAt,
          receivedById: data.receivedById || null,
          notes: data.notes,
          receiptNumber,
        },
        include: { receivedBy: true },
      });
      return NextResponse.json(entry, { status: 201 });
    } catch (err) {
      const isReceiptCollision =
        typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
      if (isReceiptCollision && attempt === 0) continue;
      throw err;
    }
  }

  return errorResponse("เกิดข้อผิดพลาด กรุณาลองใหม่", 500);
}
