import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminSidebar } from "./AdminSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

export function AdminLayout() {
  const { user, loading } = useAuth();
  
  // Enable realtime notifications for admin users
  useRealtimeNotifications();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b bg-card flex items-center px-4 gap-4">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">
              Área Administrativa
            </span>
          </header>
          <div className="flex-1 overflow-auto bg-secondary/30">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
