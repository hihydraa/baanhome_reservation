import { prisma } from "@/lib/prisma";
import { getDownloadUrl } from "@/lib/r2";

export async function listAttachments(bookingType: "ACCOMMODATION" | "BANQUET", bookingId: string) {
  const attachments = await prisma.attachment.findMany({
    where: bookingType === "ACCOMMODATION" ? { accommodationBookingId: bookingId } : { banquetBookingId: bookingId },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    attachments.map(async (a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt.toISOString(),
      uploadedBy: a.uploadedBy,
      url: await getDownloadUrl(a.key),
    }))
  );
}
