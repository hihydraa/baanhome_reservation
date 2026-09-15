import { NextRequest, NextResponse } from "next/server";
import { requireSession, zodErrorResponse } from "@/lib/api-helpers";
import { checkConflictInputSchema } from "@/lib/validators";
import { combineDateAndTime, parseDateOnly, formatThaiDate, formatTime } from "@/lib/dates";
import { findBanquetConflict } from "@/lib/booking-conflicts";

export async function POST(req: NextRequest) {
  const { response } = await requireSession();
  if (response) return response;

  const body = await req.json();
  const parsed = checkConflictInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  if (data.endTime <= data.startTime) {
    return NextResponse.json({ conflict: false });
  }

  const eventDate = parseDateOnly(data.eventDate);
  const startTime = combineDateAndTime(data.eventDate, data.startTime);
  const endTime = combineDateAndTime(data.eventDate, data.endTime);

  const conflict = await findBanquetConflict({
    resourceId: data.resourceId,
    eventDate,
    startTime,
    endTime,
    excludeBookingId: data.excludeBookingId,
  });

  if (!conflict) return NextResponse.json({ conflict: false });

  return NextResponse.json({
    conflict: true,
    with: {
      id: conflict.id,
      customerName: conflict.customerName,
      resourceName: conflict.resource.name,
      timeRange: `${formatTime(conflict.startTime)} - ${formatTime(conflict.endTime)}`,
      date: formatThaiDate(conflict.eventDate),
    },
  });
}
