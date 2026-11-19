import { buildAlerts } from "@/lib/kpi-alerts";
import { computeKpiMonth, loadKpiMonth } from "@/lib/kpi";
import { loadPerformance } from "@/lib/performance";
import { GRADE_LABELS } from "@/lib/kpi-config";
import { toDateOnlyString, todayDateOnly } from "@/lib/dates";

export const MAX_AI_MONTHS = 12;

const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const label = (m: string) => `${THAI_MONTHS[Number(m.slice(5, 7)) - 1]} ${Number(m.slice(0, 4)) + 543}`;

/** The months from `from` to `to` ("yyyy-mm"), oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** Null when the range is fine, otherwise the reason (shown to the user). */
export function validateRange(from: string, to: string): string | null {
  const re = /^\d{4}-(0[1-9]|1[0-2])$/;
  if (!re.test(from) || !re.test(to)) return "รูปแบบเดือนไม่ถูกต้อง";
  if (from > to) return "เดือนเริ่มต้นต้องไม่หลังเดือนสิ้นสุด";
  const thisMonth = toDateOnlyString(todayDateOnly()).slice(0, 7);
  if (to > thisMonth) return "เลือกเดือนที่ยังมาไม่ถึงไม่ได้";
  if (monthsBetween(from, to).length > MAX_AI_MONTHS) return `เลือกได้ไม่เกิน ${MAX_AI_MONTHS} เดือนต่อครั้ง`;
  return null;
}

/**
 * Everything the model may use, as plain figures: each month's KPIs against the targets, the latest month's alerts and
 * pace, and room-level occupancy over the whole range. No customer names, phone numbers or other personal data.
 */
export async function buildAiContext(from: string, to: string) {
  const months = monthsBetween(from, to);
  const [perMonth, latest] = await Promise.all([Promise.all(months.map((m) => computeKpiMonth(m))), loadKpiMonth(to)]);

  const lastDay = new Date(Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)), 0)).getUTCDate();
  const perf = await loadPerformance(`${from}-01`, `${to}-${String(lastDay).padStart(2, "0")}`);
  const rooms = [...perf.accommodationOcc.byRoom].sort((a, b) => b.rate - a.rate);

  return {
    ช่วงที่วิเคราะห์: `${label(from)} – ${label(to)}`,
    หมายเหตุ: [
      "คะแนนรวมเต็ม 100 (สูงสุด 120) ได้จากผลรวม น้ำหนัก × % คะแนน ของ KPI 9 ตัว",
      "ระดับเป้าหมาย: น้อยสุด=0%, ผ่าน=50%, ดีเยี่ยม=100%, เกินเป้าหมาย=120% ของคะแนน KPI นั้น",
      "เดือนที่ยังไม่จบ ตัวเลขสะสมเป็นยอดถึงวันนี้ ส่วน OCC นับรวมการจองล่วงหน้าทั้งเดือน",
      "เป้าหมายมีเฉพาะ ก.ค.–ธ.ค. 2569 เดือนอื่นไม่มีเป้าและไม่มีคะแนน",
    ],
    รายเดือน: perMonth.map((m) => ({
      เดือน: label(m.month),
      ยังไม่จบเดือน: m.inProgress,
      มีเป้าหมาย: m.hasTargets,
      คะแนนรวม: m.hasTargets ? Math.round(m.points * 10) / 10 : null,
      ยอดขายแยกช่องทาง_บาท: { สวนอาหาร: m.sales.food, ห้องพัก: Math.round(m.sales.accommodation), งานจัดเลี้ยง: Math.round(m.sales.banquet) },
      KPI: m.kpis.map((k) => ({
        ชื่อ: k.def.label,
        น้ำหนัก: k.def.weight,
        หน่วย: k.def.unit === "percent" ? "%" : k.def.unit === "baht" ? "บาท" : k.def.unit === "perDay" ? "บิล/วัน" : "งาน",
        ผลจริง: k.value == null ? null : Math.round(k.value * 10) / 10,
        ระดับ: k.grade ? GRADE_LABELS[k.grade] : null,
        เป้าผ่าน: k.levels?.pass ?? null,
        เป้าดีเยี่ยม: k.levels?.excellent ?? null,
        คะแนนที่ได้: k.points == null ? null : Math.round(k.points * 10) / 10,
        ข้อมูลที่ขาด: k.missing === "INPUT" ? "ยังไม่ได้กรอก" : k.missing === "POS" ? "อ่านข้อมูล POS ไม่ได้" : null,
      })),
    })),
    เดือนล่าสุด_รายการเตือน: buildAlerts(latest, true).map((a) => ({ ระดับ: a.level === "RED" ? "แดง" : "เหลือง", ข้อความ: a.text })),
    เดือนล่าสุด_จังหวะยอดขาย: latest.pace
      ? {
          ทำได้เทียบเป้าถึงวันนี้_เปอร์เซ็นต์: Math.round(latest.pace.toDatePct),
          คาดสิ้นเดือน_บาท: Math.round(latest.pace.projected),
          ต้องทำต่อวัน_บาท: latest.pace.neededPerDay == null ? null : Math.round(latest.pace.neededPerDay),
          เหลืออีก_วัน: latest.pace.remainingDays,
        }
      : null,
    ห้องพักตลอดช่วง: {
      OCC_ตามโซน: perf.accommodationOcc.byZone.map((z) => ({ โซน: z.zone === "RESORT" ? "รีสอร์ท" : "พูลวิลล่า", OCC_เปอร์เซ็นต์: Math.round(z.rate * 10) / 10, จำนวนห้อง: z.roomCount })),
      ห้อง_OCC_สูงสุด: rooms.slice(0, 5).map((r) => ({ ห้อง: r.name, OCC_เปอร์เซ็นต์: Math.round(r.rate * 10) / 10 })),
      ห้อง_OCC_ต่ำสุด: rooms.slice(-5).reverse().map((r) => ({ ห้อง: r.name, OCC_เปอร์เซ็นต์: Math.round(r.rate * 10) / 10 })),
    },
    ห้องจัดเลี้ยงตลอดช่วง: { OCC_เปอร์เซ็นต์: Math.round(perf.banquetOcc.rate * 10) / 10, จำนวนงาน: perf.bookingCounts.banquet },
  };
}

export const SYSTEM_PROMPT = `คุณเป็นนักวิเคราะห์ผลการดำเนินงานของ "สวนอาหารบ้านโฮม (BaanHome)" ซึ่งมีร้านอาหาร ห้องพักรีสอร์ท พูลวิลล่า และห้องจัดเลี้ยง
งานของคุณคือสรุป KPI ให้ผู้บริหารอ่านเข้าใจได้เร็ว เป็นภาษาไทย กระชับ ไม่เกินประมาณ 500 คำ

กฎ:
- ใช้เฉพาะตัวเลขที่ได้รับใน JSON ห้ามแต่งตัวเลขหรือข้อเท็จจริงเพิ่ม ถ้าไม่มีข้อมูลให้บอกว่าไม่มีข้อมูล
- อ้างตัวเลขจริงประกอบทุกข้อสังเกต (ผลจริง เทียบเป้า เทียบเดือนก่อน)
- สาเหตุที่เป็นไปได้ให้เขียนว่าเป็น "ข้อสันนิษฐาน" ที่ควรตรวจสอบ ห้ามพูดเหมือนเป็นข้อเท็จจริง
- เดือนที่ยังไม่จบ ให้ระวังเปรียบเทียบยอดสะสมกับเป้าทั้งเดือน
- ถ้า KPI ไหนยังไม่มีข้อมูล (ยังไม่ได้กรอก/อ่านไม่ได้) ให้ระบุในส่วนสุดท้าย

รูปแบบคำตอบ (ใช้ markdown หัวข้อ ## และรายการ -):
## ภาพรวม
(2–3 ประโยค: คะแนนรวม แนวโน้มในช่วงที่เลือก ระดับ Performance)
## จุดแข็ง
## ต้องเร่งแก้ไข
(เรียงตามน้ำหนักคะแนน ใส่ตัวเลข)
## ข้อสังเกตและสาเหตุที่เป็นไปได้
## ข้อเสนอแนะ
(3–5 ข้อ ทำได้จริง ระบุตัวเลขที่ต้องไปให้ถึงถ้าคำนวณได้)
## ข้อมูลที่ยังขาด`;

const API_BASE = process.env.ANTHROPIC_API_BASE ?? "https://api.anthropic.com";
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/**
 * Calls Claude with the figures and returns the text as it is written, ready to stream to the browser. Throws an
 * Error (with a message fit to show) when the key is missing or Anthropic refuses the request.
 */
export async function streamAnalysis(context: unknown): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ในเซิร์ฟเวอร์");
  const res = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 2000,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `วิเคราะห์ Performance จากข้อมูล KPI นี้:\n\n${JSON.stringify(context, null, 1)}` }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(res.status === 401 ? "API key ไม่ถูกต้อง (401)" : `Anthropic API ตอบกลับสถานะ ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  // Server-sent events: pull the text out of each content_block_delta.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const ev of events) {
        const data = ev.split("\n").find((l) => l.startsWith("data:"));
        if (!data) continue;
        try {
          const json = JSON.parse(data.slice(5).trim());
          if (json.type === "content_block_delta" && json.delta?.type === "text_delta") controller.enqueue(encoder.encode(json.delta.text));
          if (json.type === "error") controller.error(new Error(json.error?.message ?? "Anthropic API error"));
        } catch {
          // A partial or non-JSON line: ignore it.
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}
