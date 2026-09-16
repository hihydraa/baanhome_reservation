import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { AccommodationPriceTable } from "@/components/pricing/AccommodationPriceTable";
import { BanquetPriceManager } from "@/components/pricing/BanquetPriceManager";
import { SpecialServiceManager } from "@/components/special-services/SpecialServiceManager";
import { ZONE_LABELS } from "@/lib/labels";
import { ACCOMMODATION_SALE_PRICES } from "@/lib/pricing";

export default async function PricingPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") {
    redirect("/dashboard");
  }

  const [accommodationResources, banquetResources, services] = await Promise.all([
    prisma.resource.findMany({
      where: { type: "ACCOMMODATION" },
      orderBy: [{ zone: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.resource.findMany({
      where: { type: "BANQUET" },
      orderBy: [{ sortOrder: "asc" }],
    }),
    prisma.specialService.findMany({ orderBy: { name: "asc" } }),
  ]);

  const zones = ["RESORT", "POOL_VILLA"] as const;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ราคาห้องพัก / ห้องจัดเลี้ยง</h1>
        <p className="text-sm text-ink-600">
          แก้ไขราคาได้โดยตรง สำหรับใช้อ้างอิงและคำนวณเมื่อจองห้อง
        </p>
      </div>

      <Tabs defaultValue="accommodation">
        <TabsList>
          <TabsTrigger value="accommodation">ห้องพัก</TabsTrigger>
          <TabsTrigger value="banquet">ห้องจัดเลี้ยง</TabsTrigger>
          <TabsTrigger value="extra">ค่าบริการเพิ่มเติม</TabsTrigger>
        </TabsList>

        <TabsContent value="accommodation" className="flex flex-col gap-6">
          {zones.map((zone) => {
            const rows = accommodationResources
              .filter((r) => r.zone === zone)
              .map((r) => ({ id: r.id, name: r.name, price: r.price != null ? Number(r.price) : null }));
            if (rows.length === 0) return null;
            return (
              <div key={zone} className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-forest-800">{ZONE_LABELS[zone] ?? zone}</h2>
                <AccommodationPriceTable rows={rows} />
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
          <BanquetPriceManager
            rows={banquetResources.map((r) => ({
              id: r.id,
              name: r.name,
              roomType: r.roomType,
              capacity: r.capacity,
              hourlyPrice: r.hourlyPrice != null ? Number(r.hourlyPrice) : null,
              dailyPrice: r.dailyPrice != null ? Number(r.dailyPrice) : null,
              priceCondition: r.priceCondition,
              equipment: r.equipment,
            }))}
          />
        </TabsContent>

        <TabsContent value="extra" className="flex flex-col gap-4">
          <p className="text-sm text-ink-600">
            กำหนดชื่อและราคาบริการเสริม เมื่อจองห้องพักแล้วเลือกบริการนี้ ราคาจะถูกดึงมาให้อัตโนมัติ
          </p>
          <SpecialServiceManager services={services.map((s) => ({ ...s, price: Number(s.price) }))} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
