import type { Metadata } from "next";
import Link from "next/link";
import { Factory } from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "WorkinFlow — ระบบจัดการโรงงาน CNC ครบวงจร",
  description:
    "WorkinFlow Cloud — แพลตฟอร์ม SaaS สำหรับโรงงานไทย ครอบคลุม MOM (Manufacturing Operations Management), HRM, และอื่นๆ ใช้งานได้ทันที ไม่ต้องติดตั้งเซิร์ฟเวอร์",
};

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://mom.workinflow.cloud";

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <div className="min-h-screen flex flex-col bg-background">
        {/* Navbar */}
        <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
          <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Factory className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">WorkinFlow</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/#features" className="text-muted-foreground hover:text-foreground transition">
                Features
              </Link>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition">
                Pricing
              </Link>
              <Link href="/#faq" className="text-muted-foreground hover:text-foreground transition">
                FAQ
              </Link>
            </nav>

            <div className="flex items-center gap-2">
              <a
                href={`${APP_URL}/th/login`}
                className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition px-3 py-2"
              >
                Login
              </a>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-blue-600 transition"
              >
                เริ่มใช้ฟรี
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t bg-muted/30">
          <div className="container mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="font-semibold text-foreground mb-1">WorkinFlow</div>
                <div>© {new Date().getFullYear()} WorkinFlow Cloud — All rights reserved.</div>
              </div>
              <div className="flex gap-6">
                <Link href="/privacy" className="hover:text-foreground transition">Privacy</Link>
                <Link href="/terms" className="hover:text-foreground transition">Terms</Link>
                <a href="mailto:hello@workinflow.cloud" className="hover:text-foreground transition">
                  Contact
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
