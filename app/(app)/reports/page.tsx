import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonthNav } from "@/components/reports/MonthNav";
import { ExportPanel } from "@/components/reports/ExportPanel";
import {
  getOccupancySummary,
  getMonthlySummary,
  getDatabaseStorageInfo,
  currentMonthString,
  formatBytes,
} from "@/lib/reports";
import { ZONE_LABELS, SOURCE_LABELS } from "@/lib/labels";
import { formatThaiMonthYear, parseDateOnly } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const { tab, month: monthParam } = await searchParams;
  const month = monthParam ?? currentMonthString();
  const tabValue = tab === "export" ? "export" : "overview";

  const [occupancy, summary, storage] = await Promise.all([
    getOccupancySummary(month),
    getMonthlySummary(month),
    getDatabaseStorageInfo(),
  ]);

  const monthLabel = formatThaiMonthYear(parseDateOnly(`${month}-01`));
  const storagePercent = storage.usedRatio * 100;
  const storageBarColor =
    storage.usedRatio > 0.9 ? "bg-red-600" : storage.usedRatio > 0.7 ? "bg-gold-500" : "bg-forest-600";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">รายงาน</h1>
        <p className="text-sm text-ink-600">สรุปภาพรวมสำหรับผู้บริหาร และส่งออกข้อมูลการจอง</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">พื้นที่ฐานข้อมูล (Neon Free Tier)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-1">
            <span className="text-2xl font-bold text-forest-800">{formatBytes(storage.usedBytes)}</span>
            <span className="text-sm text-ink-400">
              จาก {formatBytes(storage.limitBytes)} ({storagePercent.toFixed(1)}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-cream-200">
            <div
              className={cn("h-full rounded-full", storageBarColor)}
              style={{ width: `${Math.min(100, storagePercent)}%` }}
            />
          </div>
          <p className="text-xs text-ink-400">
            ตัวเลขโดยประมาณจากขนาดฐานข้อมูลจริง ค่าที่แม่นยำที่สุดให้เช็คที่หน้า Billing ในเว็บ Neon
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue={tabValue}>
        <TabsList>
          <TabsTrigger value="overview">สรุปภาพรวม</TabsTrigger>
          <TabsTrigger value="export">ส่งออกข้อมูล</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6">
          <MonthNav month={month} />

          <div>
            <h2 className="mb-2 text-sm font-semibold text-forest-800">อัตราการเข้าพัก (OCC. Rate) — {monthLabel}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {occupancy.map((z) => (
                <Card key={z.zone}>
                  <CardHeader>
                    <CardTitle>OCC. Rate — {ZONE_LABELS[z.zone] ?? z.zone}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-gold-600">{z.rate.toFixed(2)}%</p>
                    <p className="mt-1 text-sm text-ink-400">
                      {z.occupiedNights.toLocaleString("th-TH")} / {z.capacityNights.toLocaleString("th-TH")} คืน
                      ({z.roomCount} ห้อง)
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">รายรับที่เก็บแล้ว</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-forest-800">
                  {summary.revenue.collected.toLocaleString("th-TH")} บาท
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ยอดค้างชำระ</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">
                  {summary.revenue.outstanding.toLocaleString("th-TH")} บาท
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">การจองห้องพัก</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-forest-800">{summary.accommodation.total}</p>
                <p className="text-sm text-ink-400">ยกเลิก {summary.accommodation.cancelled} รายการ</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">การจองห้องจัดเลี้ยง</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-forest-800">{summary.banquet.total}</p>
                <p className="text-sm text-ink-400">
                  รวม {summary.banquet.bookedHours.toLocaleString("th-TH")} ชม. · ยกเลิก {summary.banquet.cancelled} รายการ
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">ช่องทางการจองห้องพัก</CardTitle>
            </CardHeader>
            <CardContent>
              {summary.accommodation.bySource.length === 0 ? (
                <p className="text-sm text-ink-400">ไม่มีข้อมูลการจองในเดือนนี้</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {summary.accommodation.bySource
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <div key={s.source} className="flex items-center justify-between text-sm">
                        <span className="text-ink-600">{SOURCE_LABELS[s.source] ?? s.source}</span>
                        <span className="font-semibold text-forest-800">{s.count} รายการ</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <ExportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
