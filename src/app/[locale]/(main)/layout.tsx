import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TrialBanner } from "@/components/layout/trial-banner";
import { TenantProvider } from "@/hooks/use-plan";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TenantProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <TrialBanner />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </TenantProvider>
  );
}
