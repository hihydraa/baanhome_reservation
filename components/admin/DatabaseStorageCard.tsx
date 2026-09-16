import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatBytes, type DatabaseStorageInfo } from "@/lib/reports";
import { cn } from "@/lib/utils";

export function DatabaseStorageCard({ storage }: { storage: DatabaseStorageInfo }) {
  const percent = storage.usedRatio * 100;
  const barColor = storage.usedRatio > 0.9 ? "bg-red-600" : storage.usedRatio > 0.7 ? "bg-gold-500" : "bg-forest-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">พื้นที่ฐานข้อมูล (Neon Free Tier)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <span className="text-2xl font-bold text-forest-800">{formatBytes(storage.usedBytes)}</span>
          <span className="text-sm text-ink-400">
            จาก {formatBytes(storage.limitBytes)} ({percent.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-cream-200">
          <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, percent)}%` }} />
        </div>
        <p className="text-xs text-ink-400">
          ตัวเลขโดยประมาณจากขนาดฐานข้อมูลจริง ค่าที่แม่นยำที่สุดให้เช็คที่หน้า Billing ในเว็บ Neon
        </p>
      </CardContent>
    </Card>
  );
}
