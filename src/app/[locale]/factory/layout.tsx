import { ThemeProvider } from "@/components/theme-provider";

export default function FactoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-foreground">
        {children}
      </div>
    </ThemeProvider>
  );
}
