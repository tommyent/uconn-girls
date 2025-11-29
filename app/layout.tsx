import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { RegisterServiceWorker } from "./register-sw";

export const metadata: Metadata = {
  title: "UConn Women's Basketball Tracker",
  description: "Track UConn Women's Basketball live scores, stats, and history",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UConn WBB",
  },
};

export const viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans">
        <RegisterServiceWorker />
        <div className="pb-24">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
