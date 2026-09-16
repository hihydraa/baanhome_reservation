import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireWriteAccess, zodErrorResponse, errorResponse } from "@/lib/api-helpers";
import { specialServiceInputSchema } from "@/lib/validators";

export async function GET() {
  const { response } = await requireSession();
  if (response) return response;

  const services = await prisma.specialService.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const { response } = await requireWriteAccess();
  if (response) return response;

  const body = await req.json();
  const parsed = specialServiceInputSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(parsed.error);
  const data = parsed.data;

  const existing = await prisma.specialService.findUnique({ where: { name: data.name } });
  if (existing) return errorResponse("มีบริการนี้อยู่แล้ว", 409);

  const service = await prisma.specialService.create({ data });
  return NextResponse.json(service, { status: 201 });
}
