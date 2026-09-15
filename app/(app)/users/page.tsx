import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserManager } from "@/components/users/UserManager";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-forest-800">จัดการผู้ใช้งาน</h1>
      <UserManager
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={session.user.id}
      />
    </div>
  );
}
