import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse } from "@/lib/api-helpers";
import { parseDateOnly } from "@/lib/dates";

const inputSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** ADMIN/STAFF (the counter) confirm they checked a day's cleaning log — stands in for the paper signature. */
export async function POST(req: NextRequest) {
  const { session, response } = await requireWriteAccess();
  if (response) return response;

  const parsed = inputSchema.safeParse(await req.json());
  if (!parsed.success) return zodErrorResponse(parsed.error);

  const date = parseDateOnly(parsed.data.date);
  const review = await prisma.cleaningDayReview.upsert({
    where: { date },
    create: { date, userId: session!.user.id, userName: session!.user.name ?? "-" },
    update: { userId: session!.user.id, userName: session!.user.name ?? "-", createdAt: new Date() },
  });
  return NextResponse.json(review, { status: 201 });
}
