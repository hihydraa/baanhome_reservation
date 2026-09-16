import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ZONE_LABELS } from "@/lib/labels";
import {
  ACCOMMODATION_PRICE_LIST,
  ACCOMMODATION_SALE_PRICES,
  BANQUET_PRICE_LIST,
  ADDITIONAL_CHARGE_LIST,
} from "@/lib/pricing";

export default async function PricingPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") {
    redirect("/dashboard");
  }

  const zones = ["RESORT", "POOL_VILLA"] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ราคาห้องพัก / ห้องจัดเลี้ยง</h1>
        <p className="text-sm text-ink-600">อัตราค่าห้องพักและห้องจัดเลี้ยงมาตรฐาน สำหรับใช้อ้างอิงเมื่อแจ้งราคาลูกค้า</p>
      </div>

      <Tabs defaultValue="accommodation">
        <TabsList>
          <TabsTrigger value="accommodation">ห้องพัก</TabsTrigger>
          <TabsTrigger value="banquet">ห้องจัดเลี้ยง</TabsTrigger>
          <TabsTrigger value="extra">ค่าบริการเพิ่มเติม</TabsTrigger>
        </TabsList>

        <TabsContent value="accommodation" className="flex flex-col gap-6">
          {zones.map((zone) => {
            const rows = ACCOMMODATION_PRICE_LIST.filter((r) => r.zone === zone);
            if (rows.length === 0) return null;
            return (
              <div key={zone} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ห้อง</TableHead>
                      <TableHead>ราคาห้องพัก (บาท/คืน)</TableHead>
                      <TableHead>Agoda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.name}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.price.toLocaleString("th-TH")}</TableCell>
                        <TableCell className="text-ink-400">ระบุเอง</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}

          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-forest-800">ราคาเซลล์ / ตัวแทน</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ประเภทห้อง</TableHead>
                  <TableHead>ราคา (บาท/คืน)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ACCOMMODATION_SALE_PRICES.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>{r.price != null ? r.price.toLocaleString("th-TH") : "ระบุเอง"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-ink-400">
            หมายเหตุ: ช่องทางการจอง Agoda ราคาห้องพักให้กรอกเองตามยอดจริงในระบบ Agoda ทุกครั้ง
          </p>
        </TabsContent>

        <TabsContent value="banquet">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ห้อง</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>รองรับสูงสุด</TableHead>
                <TableHead>ราคา/ชั่วโมง</TableHead>
                <TableHead>ราคาเหมาทั้งวัน</TableHead>
                <TableHead>เงื่อนไขพิเศษ</TableHead>
                <TableHead>อุปกรณ์หลัก</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {BANQUET_PRICE_LIST.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.type}</Badge>
                  </TableCell>
                  <TableCell>{r.maxCapacity} คน</TableCell>
                  <TableCell>{r.hourlyPrice.toLocaleString("th-TH")} บาท</TableCell>
                  <TableCell>{r.dailyPrice.toLocaleString("th-TH")} บาท</TableCell>
                  <TableCell className="max-w-xs text-sm text-ink-600">{r.condition || "-"}</TableCell>
                  <TableCell className="max-w-xs text-sm text-ink-600">{r.equipment}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="extra">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>รายการ</TableHead>
                <TableHead>ราคา</TableHead>
                <TableHead>หน่วย</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADDITIONAL_CHARGE_LIST.map((r) => (
                <TableRow key={r.name}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.price === "ระบุเอง" ? r.price : `${r.price} บาท`}</TableCell>
                  <TableCell className="text-ink-600">{r.unit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
