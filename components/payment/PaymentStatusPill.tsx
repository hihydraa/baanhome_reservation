import { Badge } from "@/components/ui/badge";
import { paymentBadgeInfo } from "@/lib/payment-calc";

export function PaymentStatusPill({ paid, expectedTotal }: { paid: number; expectedTotal: number }) {
  const info = paymentBadgeInfo(paid, expectedTotal);
  return <Badge variant={info.variant}>{info.label}</Badge>;
}
