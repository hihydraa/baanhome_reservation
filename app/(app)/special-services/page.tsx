import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { SpecialServiceManager } from "@/components/special-services/SpecialServiceManager";

export default async function SpecialServicesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const services = await prisma.specialService.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">บริการพิเศษ</h1>
        <p className="text-sm text-ink-600">
          กำหนดชื่อและราคาบริการเสริม เมื่อจองห้องพักแล้วเลือกบริการนี้ ราคาจะถูกดึงมาให้อัตโนมัติ
        </p>
      </div>
      <SpecialServiceManager services={services.map((s) => ({ ...s, price: Number(s.price) }))} />
    </div>
  );
}
