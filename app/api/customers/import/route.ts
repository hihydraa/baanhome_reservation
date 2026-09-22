import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, zodErrorResponse } from "@/lib/api-helpers";

const importInputSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string(),
        phone: z.string().optional(),
        taxId: z.string().optional(),
      })
    )
    .max(5000, "นำเข้าได้ครั้งละไม่เกิน 5,000 รายการ"),
});

export async function POST(req: NextRequest) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = importInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsed.data.rows) {
    const name = row.name.trim();
    if (!name) {
      skipped++;
      continue;
    }
    const phone = row.phone?.trim() || null;
    const taxId = row.taxId?.trim() || null;

    const existing = await prisma.customer.findFirst({ where: { name } });
    if (!existing) {
      await prisma.customer.create({ data: { name, phone, taxId } });
      created++;
      continue;
    }
    const fillPatch: { phone?: string; taxId?: string } = {};
    if (phone && !existing.phone) fillPatch.phone = phone;
    if (taxId && !existing.taxId) fillPatch.taxId = taxId;
    if (Object.keys(fillPatch).length > 0) {
      await prisma.customer.update({ where: { id: existing.id }, data: fillPatch });
      updated++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({ created, updated, skipped });
}
