import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CustomerManager } from "@/components/customers/CustomerManager";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user || session.user.role === "HOUSEKEEPER") {
    redirect("/dashboard");
  }

  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-forest-800">ฐานข้อมูลลูกค้า</h1>
        <p className="text-sm text-ink-600">
          รายชื่อนี้จะถูกใช้ค้นหา/เติมชื่ออัตโนมัติตอนจองห้องพักและห้องจัดเลี้ยง และบันทึกลูกค้าใหม่ให้เองทุกครั้งที่มีการจอง
        </p>
      </div>
      <CustomerManager customers={customers} />
    </div>
  );
}
