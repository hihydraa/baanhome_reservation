import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWriteAccess, errorResponse } from "@/lib/api-helpers";
import { deleteObject } from "@/lib/r2";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) return errorResponse("ไม่พบไฟล์นี้", 404);

  await deleteObject(attachment.key);
  await prisma.attachment.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
