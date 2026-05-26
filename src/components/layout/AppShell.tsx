import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, FileText, FolderOpen, Menu, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { UserProfileDrawerSection, UserProfileMenu } from "@/components/layout/UserProfileMenu";

const nav = [
  { to: "/", label: "New Quote", icon: Plus },
  { to: "/records", label: "Records", icon: FolderOpen },
  { to: "/trends", label: "Insights", icon: BarChart3 },
  { to: "/catalog", label: "Catalog", icon: Package },
];

function NavLinks({
  pathname,
  onNavigate,
  className,
  showLabels = "always",
}: {
  pathname: string;
  onNavigate?: () => void;
  className?: string;
  /** Desktop header: labels from md up (matches original). Mobile sheet: always show labels. */
  showLabels?: "always" | "from-md";
}) {
  return (
    <>
      {nav.map((item) => {
        const active =
          item.to === "/"
            ? pathname === "/" || pathname.startsWith("/quote")
            : pathname.startsWith(item.to);
        return (
          <Link key={item.to} to={item.to} onClick={onNavigate}>
            <Button
              variant={active ? "secondary" : "ghost"}
              size="sm"
              className={cn("w-full justify-start md:w-auto", active && "font-medium", className)}
            >
              <item.icon className="h-4 w-4 shrink-0 md:mr-1.5" />
              <span className={showLabels === "from-md" ? "hidden md:inline" : undefined}>{item.label}</span>
            </Button>
          </Link>
        );
      })}
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isOwnerNav = role !== "superadmin";

  return (
    <div className="min-h-screen bg-gradient-mesh">
      <header className="no-print sticky top-0 z-30 backdrop-blur-xl bg-background/80 border-b">
        <div className="max-w-[min(100%,1920px)] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <Link to={role === "superadmin" ? "/admin" : "/"} className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
              <FileText className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight truncate">QuoteGen</span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline shrink-0">Workflow</span>
          </Link>

          <nav className="flex items-center justify-end min-w-0">
            {isOwnerNav && (
              <>
                <div className="hidden md:flex items-center gap-1">
                  <NavLinks pathname={pathname} showLabels="from-md" />
                </div>
                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 md:hidden shrink-0"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    className="w-[min(100vw-2rem,320px)] p-0 sm:max-w-sm flex flex-col h-full max-h-[100dvh]"
                  >
                    <SheetHeader className="px-4 pt-6 pb-3 text-left border-b shrink-0">
                      <SheetTitle className="text-base">Menu</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto p-3">
                      <div className="flex flex-col gap-1">
                        <NavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
                      </div>
                    </div>
                    <UserProfileDrawerSection onClose={() => setMobileNavOpen(false)} />
                  </SheetContent>
                </Sheet>
              </>
            )}
            {/* Desktop header profile; on mobile (owner) profile lives in the drawer */}
            <UserProfileMenu className={isOwnerNav ? "hidden md:flex" : undefined} />
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
