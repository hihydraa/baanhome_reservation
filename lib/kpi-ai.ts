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

type MonthResult = Awaited<ReturnType<typeof computeKpiMonth>>;

const fmtNum = (v: number, d = 0) => v.toLocaleString("th-TH", { maximumFractionDigits: d });
function fmtVal(v: number | null, unit: string): string {
  if (v == null) return "ไม่มีข้อมูล";
  if (unit === "percent") return `${fmtNum(v, 1)}%`;
  if (unit === "baht") return `${fmtNum(v)} บาท`;
  if (unit === "perDay") return `${fmtNum(v, 1)} บิล/วัน`;
  return `${fmtNum(v, 0)} งาน`;
}

/**
 * The figures part of the meeting document, written by code (not the model) so it is always complete and exact: per
 * month a scorecard table, the sales by channel, and data-quality notes where a channel has no sales at all.
 */
export function buildFactSheet(perMonth: MonthResult[]): string {
  const out: string[] = ["## 1. ผลการดำเนินงานเทียบเป้าหมาย (ข้อมูลจากระบบ)"];
  for (const m of perMonth) {
    out.push(`### ${label(m.month)}${m.inProgress ? " (ระหว่างเดือน)" : ""}${m.hasTargets ? ` — คะแนนรวม ${fmtNum(m.points ?? 0, 1)}/100` : " — ไม่มีเป้าหมาย"}`);
    if (m.hasTargets) {
      out.push("| KPI | ผลจริง | เป้าผ่าน | เป้าดีเยี่ยม | ระดับ | คะแนน |");
      out.push("|---|---|---|---|---|---|");
      for (const k of m.kpis) {
        out.push(
          `| ${k.def.label} | ${fmtVal(k.value, k.def.unit)} | ${k.levels ? fmtVal(k.levels.pass, k.def.unit) : "-"} | ${k.levels ? fmtVal(k.levels.excellent, k.def.unit) : "-"} | ${k.grade ? GRADE_LABELS[k.grade] : k.missing === "INPUT" ? "ยังไม่กรอก" : k.missing === "POS" ? "อ่าน POS ไม่ได้" : "-"} | ${k.points == null ? "-" : `${fmtNum(k.points, 1)}/${k.def.weight}`} |`
        );
      }
    }
    out.push(`- ยอดขายแยกช่องทาง: สวนอาหาร ${m.sales.food == null ? "อ่านข้อมูล POS ไม่ได้" : fmtNum(m.sales.food)} / ห้องพัก ${fmtNum(m.sales.accommodation)} / งานจัดเลี้ยง ${fmtNum(m.sales.banquet)} บาท`);
    const empty = [
      m.sales.food == null ? "สวนอาหาร (อ่านข้อมูล POS ไม่ได้)" : m.sales.food <= 0 ? "สวนอาหาร" : null,
      m.sales.accommodation <= 0 ? "ห้องพัก" : null,
      m.sales.banquet <= 0 ? "งานจัดเลี้ยง" : null,
    ].filter(Boolean);
    if (empty.length) out.push(`- **ตรวจสอบข้อมูล:** ไม่มียอดขายช่อง ${empty.join(", ")} ในเดือนนี้ ควรยืนยันว่าบันทึกหรือดึงข้อมูลครบแล้ว ก่อนใช้ตัดสินใจ`);
  }
  return out.join("\n");
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

  // Figures computed here (not by the model) so the arithmetic is exact: where each KPI lost points, and the gap to targets.
  const insights = perMonth
    .filter((m) => m.hasTargets)
    .map((m) => {
      const rows = m.kpis
        .filter((k) => k.value != null && k.levels && k.scorePct != null)
        .map((k) => {
          const v = k.value as number;
          const l = k.levels!;
          const lost = Math.round(k.def.weight * (100 - (k.scorePct as number))) / 100;
          return {
            ชื่อ: k.def.label,
            คะแนนที่เสียไปจากเต็ม: Math.max(0, lost),
            ส่วนต่างจากเป้าผ่าน: Math.round((v - l.pass) * 10) / 10,
            ส่วนต่างจากเป้าดีเยี่ยม: Math.round((v - l.excellent) * 10) / 10,
            ต้องเพิ่มอีกเท่าไรถึงดีเยี่ยม: v >= l.excellent ? 0 : Math.round((l.excellent - v) * 10) / 10,
          };
        })
        .sort((a, b) => b.คะแนนที่เสียไปจากเต็ม - a.คะแนนที่เสียไปจากเต็ม);
      return { เดือน: label(m.month), KPI_เรียงตามคะแนนที่เสียไปมากสุด: rows };
    });

  const context = {
    ช่วงที่วิเคราะห์: `${label(from)} – ${label(to)}`,
    หมายเหตุ: [
      "คะแนนรวมเต็ม 100 (สูงสุด 120) ได้จากผลรวม น้ำหนัก × % คะแนน ของ KPI 9 ตัว",
      "ระดับเป้าหมาย: น้อยสุด=0%, ผ่าน=50%, ดีเยี่ยม=100%, เกินเป้าหมาย=120% ของคะแนน KPI นั้น",
      "เดือนที่ยังไม่จบ ตัวเลขสะสมเป็นยอดถึงวันนี้ ส่วน OCC นับรวมการจองล่วงหน้าทั้งเดือน",
      "เป้าหมายมีเฉพาะ ก.ค.–ธ.ค. 2569 เดือนอื่นไม่มีเป้าและไม่มีคะแนน",
    ],
    คำนวณสำเร็จรูป_ใช้ตัวเลขนี้ตามที่ให้ไม่ต้องคำนวณใหม่: insights,
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
  return { context, facts: buildFactSheet(perMonth) };
}

export const SYSTEM_PROMPT = `คุณเป็นที่ปรึกษาด้านผลการดำเนินงานของ "สวนอาหารบ้านโฮม (BaanHome)" ซึ่งมีร้านอาหาร ห้องพักรีสอร์ท พูลวิลล่า และห้องจัดเลี้ยง
คุณเขียนส่วน "วิเคราะห์" ของเอกสารประกอบการประชุมผลการดำเนินงานประจำเดือน เป็นภาษาไทยระดับทางการ กระชับ ผู้บริหารอ่านแล้วนำเข้าที่ประชุมได้ทันที
ตารางตัวเลข KPI รายเดือนและยอดขายแยกช่องทางถูกจัดทำไว้ในเอกสารแล้ว (หัวข้อ 1) ห้ามเขียนซ้ำเป็นรายเดือนอีก ให้อ้างเฉพาะตัวเลขที่จำเป็นต่อประเด็น

กฎ:
- ใช้เฉพาะตัวเลขที่ได้รับใน JSON ห้ามแต่งตัวเลขหรือข้อเท็จจริงเพิ่ม ถ้าไม่มีข้อมูลให้บอกว่าไม่มีข้อมูล
- ตัวเลข "คำนวณสำเร็จรูป" ถูกต้องแล้ว ให้ใช้ตามนั้น ห้ามคำนวณใหม่เอง
- สาเหตุที่เป็นไปได้ต้องเขียนว่าเป็น "ข้อสันนิษฐาน" ที่ต้องยืนยันในที่ประชุม ห้ามพูดเหมือนเป็นข้อเท็จจริง
- ถ้าช่องทางใดมียอด 0 หรือ KPI เป็น 0 ทั้งที่เดือนอื่นมีข้อมูล ให้ชี้ว่าอาจเป็นปัญหาการบันทึก/ดึงข้อมูล ไม่ใช่ผลงานจริง และอย่านำไปสรุปว่าผลงานแย่
- เดือนที่ยังไม่จบ ให้ระบุว่าเป็นตัวเลขระหว่างเดือน
- ผู้รับผิดชอบระบุเป็น "ฝ่าย/แผนก" เท่านั้น (ห้ามแต่งชื่อบุคคล) กรอบเวลาเป็นช่วง เช่น "ภายในสิ้นเดือนหน้า"
- ไม่ใช้ตาราง ใช้หัวข้อและรายการ
- ความยาวรวมไม่เกินประมาณ 550 คำ ต้องเขียนให้ครบทุกหัวข้อ อย่าขยายความหัวข้อใดจนยาว

โครงเอกสาร (ใช้ markdown หัวข้อ ## และรายการ -) เริ่มจากหัวข้อ 2:
## 2. สรุปสำหรับผู้บริหาร
(3–4 บรรทัด: คะแนนรวมและแนวโน้ม ข้อความสำคัญที่สุด รวมถึงข้อควรระวังด้านคุณภาพข้อมูลถ้ามี)
## 3. จุดแข็งที่ควรรักษา
(2–3 ข้อ)
## 4. ประเด็นที่ต้องเร่งแก้ไข
(3–4 ข้อ เรียงตามคะแนนที่เสียไปมากสุดของเดือนล่าสุดจากตัวเลขสำเร็จรูป ใส่ส่วนต่างจากเป้า)
## 5. สาเหตุที่เป็นไปได้ (ข้อสันนิษฐาน)
(2–4 ข้อ)
## 6. วาระและมติที่เสนอให้ที่ประชุม
(3–5 ข้อ แต่ละข้อ: เรื่อง — เป้าตัวเลข — ฝ่ายที่รับผิดชอบ — กรอบเวลา)
## 7. คำถามที่ควรถามในที่ประชุม
(2–3 ข้อ)
## 8. ข้อมูลที่ยังขาด`;

const API_BASE = process.env.ANTHROPIC_API_BASE ?? "https://api.anthropic.com";
export const aiConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/**
 * Calls Claude with the figures and returns the text as it is written, ready to stream to the browser. Throws an
 * Error (with a message fit to show) when the key is missing or Anthropic refuses the request.
 */
export async function streamAnalysis(context: unknown, timeoutMs = 52_000): Promise<ReadableStream<Uint8Array>> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ในเซิร์ฟเวอร์");
  const res = await fetch(`${API_BASE}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
      max_tokens: 3500,
      stream: true,
      // Summarising needs no deep reasoning; Sonnet 5.5 thinks at high effort by default, which delayed the answer past
      // the 60s function limit. between_tools = thinking off (allowed at effort high or below).
      thinking: { type: "between_tools" },
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `จัดทำเอกสารประกอบการประชุมประจำเดือนจากข้อมูล KPI นี้:\n\n${JSON.stringify(context, null, 1)}` }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
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
