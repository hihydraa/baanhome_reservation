import { auth } from "@/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ToastProvider } from "@/components/ui/toast-provider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user.role === "ADMIN";

  return (
    <ToastProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar isAdmin={isAdmin} />
        <div className="flex min-h-screen flex-1 flex-col">
          <Header
            name={session?.user.name ?? ""}
            role={session?.user.role ?? "STAFF"}
            isAdmin={isAdmin}
          />
          <main className="flex-1 bg-cream-100 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
