import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-helpers";
import { aiConfigured, buildAiContext, streamAnalysis, validateRange } from "@/lib/kpi-ai";

export const maxDuration = 60;

const schema = z.object({ from: z.string(), to: z.string() });

/**
 * ADMIN only: an AI summary of the KPIs for a range of months, streamed back as plain text. The model only receives
 * aggregate figures (see buildAiContext). Nothing is stored.
 */
export async function POST(req: NextRequest) {
  const { response } = await requireAdmin();
  if (response) return response;
  if (!aiConfigured()) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ในเซิร์ฟเวอร์" }, { status: 400 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  const { from, to } = parsed.data;
  const bad = validateRange(from, to);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  try {
    const t0 = Date.now();
    const context = await buildAiContext(from, to);
    const t1 = Date.now();
    const stream = await streamAnalysis(context);
    console.log(`[kpi-ai] ${from}..${to} context=${t1 - t0}ms firstByte=${Date.now() - t1}ms`);
    return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "วิเคราะห์ไม่สำเร็จ" }, { status: 502 });
  }
}
