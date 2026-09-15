import { AlertTriangle } from "lucide-react";

export function ConflictBanner({
  conflict,
}: {
  conflict: { customerName: string; resourceName: string; timeRange: string; date: string } | null;
}) {
  if (!conflict) return null;

  return (
    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">เวลานี้ชนกับการจองอื่น ไม่สามารถยืนยันได้</p>
        <p>
          ห้อง {conflict.resourceName} มีการจอง &quot;{conflict.customerName}&quot; เวลา {conflict.timeRange} วันที่{" "}
          {conflict.date} อยู่แล้ว
        </p>
      </div>
    </div>
  );
}
