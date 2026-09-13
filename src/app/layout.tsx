import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Flexicare Monitoring System",
  description: "Environmental Monitoring System – Pressure & Water Tank",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-(--bg) text-(--text)">
        <div className="lg:flex lg:flex-wrap lg:min-h-screen">
          <Sidebar />
          <main className="flex-1 lg:min-w-0 lg:h-screen lg:overflow-y-auto">
            <div className="page-enter">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
