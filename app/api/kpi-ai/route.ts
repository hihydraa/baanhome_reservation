import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api-helpers";
import { aiConfigured, buildAiContext, streamAnalysis, validateRange } from "@/lib/kpi-ai";

export const maxDuration = 300;

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
    const { context, facts } = await Promise.race([
      buildAiContext(from, to),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("STAGE:data")), 25_000)),
    ]);
    const t1 = Date.now();
    const stream = await streamAnalysis(context, Math.max(5_000, 285_000 - (t1 - t0)));
    console.log(`[kpi-ai] ${from}..${to} context=${t1 - t0}ms firstByte=${Date.now() - t1}ms`);
    // The figures section is written by code and goes out first; the model's analysis follows it.
    const enc = new TextEncoder();
    const combined = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(enc.encode(`${facts}\n\n`));
        const reader = stream.getReader();
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (e) {
          controller.enqueue(enc.encode(`\n\n> ⚠ การวิเคราะห์ถูกตัดกลางคัน (${e instanceof Error ? e.message : "ข้อผิดพลาด"}) กรุณากดวิเคราะห์ใหม่`));
          controller.close();
        }
      },
      cancel() {
        stream.cancel().catch(() => {});
      },
    });
    return new Response(combined, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const text =
      msg === "STAGE:data"
        ? "ขั้นรวบรวมข้อมูล KPI ใช้เวลาเกิน 25 วินาที (ช้าที่ฝั่งระบบ/POS ไม่ใช่ AI) ลองเลือกช่วงให้สั้นลง"
        : /abort|timeout/i.test(msg)
          ? "ขั้นรอ AI ตอบใช้เวลาเกินกำหนด (ช้าที่ฝั่ง Anthropic) ลองใหม่อีกครั้ง"
          : msg || "วิเคราะห์ไม่สำเร็จ";
    return NextResponse.json({ error: text }, { status: 502 });
  }
}
