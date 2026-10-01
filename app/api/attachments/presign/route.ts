import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { attachmentPresignInputSchema } from "@/lib/validators";
import { buildAttachmentKey, getUploadUrl } from "@/lib/r2";

export async function POST(req: NextRequest) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = attachmentPresignInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { bookingType, bookingId, fileName } = parsed.data;

  const booking =
    bookingType === "ACCOMMODATION"
      ? await prisma.accommodationBooking.findUnique({ where: { id: bookingId }, select: { id: true } })
      : await prisma.banquetBooking.findUnique({ where: { id: bookingId }, select: { id: true } });
  if (!booking) return errorResponse("ไม่พบรายการจองนี้", 404);

  const key = buildAttachmentKey(bookingType, bookingId, fileName);
  const uploadUrl = await getUploadUrl(key);

  return NextResponse.json({ uploadUrl, key });
}
