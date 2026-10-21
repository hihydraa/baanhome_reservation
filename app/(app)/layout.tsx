import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/toast-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";
  const isHousekeeper = session?.user.role === "HOUSEKEEPER";
  const canAudit = isAdmin || session?.user.role === "AUDITOR";

  // High-severity audit findings no one has ruled on yet — a badge on the audit link.
  const openFindings = canAudit ? await prisma.auditFinding.count({ where: { status: "OPEN", severity: "HIGH" } }) : 0;

  return (
    <ToastProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar isAdmin={isAdmin} canAudit={canAudit} openFindings={openFindings} isHousekeeper={isHousekeeper} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header
            name={session?.user.name ?? ""}
            role={session?.user.role ?? "STAFF"}
            isAdmin={isAdmin}
            canAudit={canAudit}
            openFindings={openFindings}
            isHousekeeper={isHousekeeper}
          />
          <main className="flex-1 bg-cream-100 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
