import { Link, useLocation } from "react-router-dom";
import { BarChart3, FileText, FolderOpen, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";

const nav = [
  { to: "/", label: "New Quote", icon: Plus },
  { to: "/records", label: "Records", icon: FolderOpen },
  { to: "/trends", label: "Insights", icon: BarChart3 },
  { to: "/catalog", label: "Catalog", icon: Package },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-[min(100%,1920px)] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <Link to={role === "superadmin" ? "/admin" : "/"} className="flex items-center gap-2 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">QuoteGen</span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">Workflow</span>
          </Link>

          <nav className="flex items-center gap-1 min-w-0">
            {role !== "superadmin" &&
              nav.map((item) => {
                const active =
                  item.to === "/"
                    ? pathname === "/" || pathname.startsWith("/quote")
                    : pathname.startsWith(item.to);
                return (
                  <Link key={item.to} to={item.to}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(active && "font-medium")}
                    >
                      <item.icon className="h-4 w-4 mr-1.5" />
                      <span className="hidden md:inline">{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            <UserProfileMenu />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
