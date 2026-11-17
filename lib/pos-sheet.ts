/**
 * Restaurant sales from the POS export in Google Sheets — the same sheet, tab and column rules as the sales
 * dashboard (public/sales-dashboard/app.js), read on the server so the KPI page can use it.
 * The sheet must be shared as "anyone with the link can view".
 */

const SHEET_ID = process.env.POS_SHEET_ID ?? "1h-_POlaVm6SIykAp5yz1vZjsJp3WPtRn-PDvkzo4Nzg";
const SHEETS_BASE = process.env.POS_SHEETS_BASE ?? "https://docs.google.com";
const DETAIL_TAB = "detail_perbill";
/** Product categories that are rooms, not food (same list as the sales dashboard). */
const LODGING_CATEGORIES = ["รีสอร์ท", "ห้องพัก พูลวิลล่า"];

type Cell = { v?: unknown } | null;
export type GvizTable = { cols: { label?: string }[]; rows: { c: Cell[] }[] };

/** Strips the callback wrapper Google puts around the JSON ("...setResponse({...});"). */
export function parseGviz(text: string): GvizTable {
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 0 || end <= start) throw new Error("ไม่ใช่คำตอบของ Google Sheets (อาจไม่ได้แชร์ชีตแบบมีลิงก์)");
  const resp = JSON.parse(text.slice(start + 1, end));
  if (resp.status === "error") {
    const d = resp.errors?.[0];
    throw new Error(`Google Sheets ตอบกลับว่าผิดพลาด: ${d?.detailed_message ?? d?.message ?? "ไม่ทราบสาเหตุ"}`);
  }
  return resp.table as GvizTable;
}

const pad2 = (n: number) => String(n).padStart(2, "0");
const cellValue = (row: { c: Cell[] }, i: number) => (row.c?.[i] ? row.c[i]!.v : null);
const str = (row: { c: Cell[] }, i: number) => {
  const v = cellValue(row, i);
  return v == null ? "" : String(v).trim();
};
const num = (row: { c: Cell[] }, i: number) => {
  const v = cellValue(row, i);
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

/** Date cell → "yyyy-mm-dd": gviz "Date(2026,10,3)" (month is 0-based), ISO text, or d/m/yyyy (Buddhist years allowed). */
function dateIso(row: { c: Cell[] }, i: number): string {
  const v = cellValue(row, i);
  if (typeof v !== "string") return "";
  let m = v.match(/^Date\((\d+),(\d+),(\d+)/);
  if (m) return `${m[1]}-${pad2(+m[2] + 1)}-${pad2(+m[3])}`;
  m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}`;
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) {
    let y = +m[3];
    if (y > 2400) y -= 543;
    return `${y}-${pad2(+m[2])}-${pad2(+m[1])}`;
  }
  return "";
}

const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
function findCol(table: GvizTable, test: (label: string) => boolean, fallback: number) {
  for (let i = 0; i < table.cols.length; i++) {
    const label = table.cols[i]?.label;
    if (label && test(norm(label))) return i;
  }
  return fallback;
}

export type PosMonth = {
  month: string;
  /** Bills with at least one non-room item. */
  foodBills: number;
  /** Net sales of the non-room items. */
  foodSales: number;
  /** Net sales of room items on POS bills (for information — rooms are counted from the booking system). */
  lodgingSales: number;
  /** Last date that has any row in the month ("yyyy-mm-dd"), or null if none. */
  lastDate: string | null;
};

/** One month of the detail sheet → bill and sales totals. Voided bills ("Void All") are left out, as on the dashboard. */
export function summarizePos(table: GvizTable, month: string): PosMonth {
  const i = {
    date: findCol(table, (l) => l.includes("วันที่"), 0),
    bill: findCol(table, (l) => l.includes("หมายเลขใบเสร็จ") || l.includes("ใบเสร็จ"), 2),
    name: findCol(table, (l) => l.includes("ชื่อเมนู") || l.includes("ชื่อสินค้า"), 6),
    net: findCol(table, (l) => l.includes("ราคาสุทธิ"), 13),
    pay: findCol(table, (l) => l.includes("ประเภทการชำระ"), 19),
    cat: findCol(table, (l) => l.includes("หมวดสินค้า"), 25),
  };
  const foodBills = new Set<string>();
  let foodSales = 0;
  let lodgingSales = 0;
  let lastDate: string | null = null;
  table.rows.forEach((r, idx) => {
    const date = dateIso(r, i.date);
    if (!date || !date.startsWith(month) || !str(r, i.name)) return;
    if (str(r, i.pay) === "Void All") return;
    if (!lastDate || date > lastDate) lastDate = date;
    const net = num(r, i.net);
    if (LODGING_CATEGORIES.includes(str(r, i.cat))) {
      lodgingSales += net;
    } else {
      foodSales += net;
      foodBills.add(str(r, i.bill) || `${date}#${idx}`);
    }
  });
  return { month, foodBills: foodBills.size, foodSales, lodgingSales, lastDate };
}

async function fetchTable(query?: string): Promise<GvizTable> {
  const url =
    `${SHEETS_BASE}/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(DETAIL_TAB)}` +
    (query ? `&tq=${encodeURIComponent(query)}` : "");
  const res = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(9_000) });
  if (!res.ok) throw new Error(`Google Sheets ตอบกลับสถานะ ${res.status}`);
  return parseGviz(await res.text());
}

/**
 * The month's POS totals, or an error message when the sheet can't be read. It first asks Google for just the month
 * (column A is the date); if that query is refused it reads the whole tab, as the sales dashboard does.
 */
export async function loadPosMonth(month: string): Promise<{ data: PosMonth } | { error: string }> {
  try {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad2(m + 1)}-01`;
    let table: GvizTable;
    try {
      table = await fetchTable(`select * where A >= date '${month}-01' and A < date '${next}'`);
    } catch {
      table = await fetchTable();
    }
    return { data: summarizePos(table, month) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "อ่านข้อมูลยอดขายร้านอาหารไม่สำเร็จ" };
  }
}
