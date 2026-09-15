import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["latin", "thai"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "บ้านโฮม Mini MICE — ระบบจองห้องพักและห้องจัดเลี้ยง",
  description: "ระบบจัดการการจองห้องพักและห้องจัดเลี้ยงภายในของบ้านโฮม",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${sarabun.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-cream-100 text-ink-900">
        {children}
      </body>
    </html>
  );
}
