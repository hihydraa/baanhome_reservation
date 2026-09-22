import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { customerInputSchema } from "@/lib/validators";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = customerInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const existing = await prisma.customer.findFirst({ where: { name: data.name.trim() } });
  if (existing) return errorResponse("มีลูกค้าชื่อนี้อยู่แล้ว", 409);

  const customer = await prisma.customer.create({
    data: { name: data.name.trim(), phone: data.phone || null, taxId: data.taxId || null },
  });
  return NextResponse.json(customer, { status: 201 });
}
