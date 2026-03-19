import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-animated bg-pattern">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center justify-end px-4 shrink-0 surface-glass sticky top-0 z-30 mx-3 mt-3 rounded-xl">
            <NotificationsDropdown />
          </header>
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="page-enter">
              {children}
            </div>
          </main>
          <footer className="shrink-0 px-4 py-2 text-center text-[10px] text-muted-foreground/60 border-t border-border/30">
            © {new Date().getFullYear()} العقيد حاتم شبشوب — إدارة الأبحاث الديوانية · النسخة v1.11 beta 2026
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}