import type { PaymentEntryAction, Prisma } from "@prisma/client";
import { PAYMENT_METHOD_LABELS } from "@/lib/labels";
import { formatThaiDate } from "@/lib/dates";
import type { PaymentEntrySnapshot } from "@/lib/payment-entry-log";

export const PAYMENT_ENTRY_ACTION_LABELS: Record<PaymentEntryAction, string> = {
  CREATE: "รับชำระ",
  UPDATE: "แก้ไข",
  DELETE: "ลบ",
};

export const PAYMENT_ENTRY_ACTION_VARIANTS: Record<PaymentEntryAction, "success" | "warning" | "danger"> = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const baht = (n: number) => `${n.toLocaleString("th-TH")} บาท`;
const method = (m: string) => PAYMENT_METHOD_LABELS[m] ?? m;
const day = (iso: string) => formatThaiDate(new Date(iso));

function asSnapshot(v: Prisma.JsonValue | null): PaymentEntrySnapshot | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as unknown as PaymentEntrySnapshot) : null;
}

function summary(s: PaymentEntrySnapshot) {
  return `${baht(s.amount)} · ${method(s.method)} · ${day(s.paidAt)}${s.receivedByName ? ` · รับโดย ${s.receivedByName}` : ""}`;
}

/** Human-readable lines for one PaymentEntryLog row (Thai). */
export function describeEntryChange(
  action: PaymentEntryAction,
  beforeJson: Prisma.JsonValue | null,
  afterJson: Prisma.JsonValue | null
): string[] {
  const before = asSnapshot(beforeJson);
  const after = asSnapshot(afterJson);

  if (action === "CREATE" && after) return [summary(after) + (after.notes ? ` · ${after.notes}` : "")];
  if (action === "DELETE" && before) return [`ลบรายการ: ${summary(before)}${before.notes ? ` · ${before.notes}` : ""}`];
  if (action !== "UPDATE" || !before || !after) return ["-"];

  const lines: string[] = [];
  if (before.amount !== after.amount) lines.push(`จำนวนเงิน ${baht(before.amount)} → ${baht(after.amount)}`);
  if (before.method !== after.method) lines.push(`วิธีชำระ ${method(before.method)} → ${method(after.method)}`);
  if (day(before.paidAt) !== day(after.paidAt)) lines.push(`วันที่รับชำระ ${day(before.paidAt)} → ${day(after.paidAt)}`);
  if (before.receivedById !== after.receivedById)
    lines.push(`ผู้รับชำระ ${before.receivedByName ?? "-"} → ${after.receivedByName ?? "-"}`);
  if (before.receiptNumber !== after.receiptNumber) lines.push(`เลขที่ใบเสร็จ ${before.receiptNumber} → ${after.receiptNumber}`);
  if ((before.notes ?? "") !== (after.notes ?? "")) lines.push(`หมายเหตุ "${before.notes ?? ""}" → "${after.notes ?? ""}"`);
  return lines.length ? lines : ["ไม่มีการเปลี่ยนแปลงข้อมูล"];
}
