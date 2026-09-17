import { CheckCircle2, AlertTriangle, Clock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { paymentBadgeInfo } from "@/lib/payment-calc";

const VARIANT_ICON: Record<string, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  muted: Clock,
};

export function PaymentStatusPill({
  paid,
  expectedTotal,
  showIcon = false,
}: {
  paid: number;
  expectedTotal: number;
  showIcon?: boolean;
}) {
  const info = paymentBadgeInfo(paid, expectedTotal);
  const Icon = VARIANT_ICON[info.variant];
  return (
    <Badge variant={info.variant} className={showIcon ? "gap-1" : undefined}>
      {showIcon && <Icon className="h-3.5 w-3.5" />}
      {info.label}
    </Badge>
  );
}
