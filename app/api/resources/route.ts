import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { response } = await requireSession();
  if (response) return response;

  const type = req.nextUrl.searchParams.get("type");

  const resources = await prisma.resource.findMany({
    where: type ? { type: type as "ACCOMMODATION" | "BANQUET" } : undefined,
    orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
  });

  return NextResponse.json(resources);
}
