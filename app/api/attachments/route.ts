import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { attachmentCreateInputSchema } from "@/lib/validators";
import { getDownloadUrl } from "@/lib/r2";
import { listAttachments } from "@/lib/attachments";

export async function GET(req: NextRequest) {
  const { response } = await requireSession();
  if (response) return response;

  const bookingType = req.nextUrl.searchParams.get("bookingType");
  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (bookingType !== "ACCOMMODATION" && bookingType !== "BANQUET") return errorResponse("bookingType ไม่ถูกต้อง");
  if (!bookingId) return errorResponse("ต้องระบุ bookingId");

  return NextResponse.json(await listAttachments(bookingType, bookingId));
}

export async function POST(req: NextRequest) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = attachmentCreateInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const { bookingType, bookingId, fileName, mimeType, size, key } = parsed.data;

  const booking =
    bookingType === "ACCOMMODATION"
      ? await prisma.accommodationBooking.findUnique({ where: { id: bookingId }, select: { id: true } })
      : await prisma.banquetBooking.findUnique({ where: { id: bookingId }, select: { id: true } });
  if (!booking) return errorResponse("ไม่พบรายการจองนี้", 404);

  const attachment = await prisma.attachment.create({
    data: {
      accommodationBookingId: bookingType === "ACCOMMODATION" ? bookingId : null,
      banquetBookingId: bookingType === "BANQUET" ? bookingId : null,
      key,
      fileName,
      mimeType,
      size,
      uploadedById: session!.user.id,
    },
  });

  return NextResponse.json({
    id: attachment.id,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt,
    uploadedBy: { id: session!.user.id, name: session!.user.name ?? session!.user.username },
    url: await getDownloadUrl(attachment.key),
  });
}
