import { Badge } from "@/components/ui/badge";
import { PAYMENT_STATUS_LABELS } from "@/lib/labels";

const VARIANT_MAP: Record<string, "success" | "warning" | "muted"> = {
  PAID: "success",
  DEPOSIT: "warning",
  PAY_LATER: "muted",
};

export function PaymentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="muted">ยังไม่ระบุ</Badge>;
  return <Badge variant={VARIANT_MAP[status] ?? "muted"}>{PAYMENT_STATUS_LABELS[status] ?? status}</Badge>;
}
