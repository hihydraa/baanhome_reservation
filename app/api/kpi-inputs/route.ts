import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, zodErrorResponse } from "@/lib/api-helpers";

const amount = (max: number) => z.number().min(0).max(max).nullable();

const schema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  /** Null clears the figure. */
  banquetCost: amount(100_000_000),
  restaurantGp: amount(100),
  evaluationPct: amount(100),
});

/** ADMIN only: the KPI figures typed in by hand for a month (banquet cost, restaurant GP %, evaluation score %). */
export async function PUT(req: NextRequest) {
  const { session, response } = await requireAdmin();
  if (response) return response;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const { month, ...values } = parsed.data;

  const who = { updatedById: session!.user.id, updatedByName: session!.user.name ?? session!.user.username };
  const saved = await prisma.kpiMonthlyInput.upsert({
    where: { month },
    create: { month, ...values, ...who },
    update: { ...values, ...who },
  });
  return NextResponse.json({ month: saved.month });
}
