import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatRoleLabel } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function useProfileDisplay() {
  const { user, role, profileName, signOut, roleLoading } = useAuth();
  const displayName = profileName || user?.email?.split("@")[0] || "User";
  const roleLabel = formatRoleLabel(role);
  return { user, displayName, roleLabel, signOut, roleLoading };
}

/** Desktop header profile control — hidden below md when used with mobile drawer profile. */
export function UserProfileMenu({ className }: { className?: string }) {
  const { user, displayName, roleLabel, signOut, roleLoading } = useProfileDisplay();

  return (
    <div className={cn("shrink-0", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-auto py-1.5 pl-1.5 pr-2 gap-2 rounded-full border border-transparent text-foreground",
              "hover:bg-muted/80 hover:border-border/60 hover:text-foreground",
              "hover:[&_.profile-role]:text-muted-foreground",
              "focus-visible:text-foreground data-[state=open]:bg-muted/80 data-[state=open]:text-foreground",
            )}
            disabled={roleLoading}
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {initials(displayName)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:flex flex-col items-start text-left leading-tight max-w-[140px]">
              <span className="text-sm font-medium truncate w-full text-foreground">{displayName}</span>
              <span className="profile-role text-[11px] text-muted-foreground">{roleLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 animate-in fade-in-0 zoom-in-95">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-1.5 py-0.5">
              <p className="text-sm font-medium leading-none">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              <Badge variant="secondary" className="w-fit text-[10px] font-medium capitalize">
                {roleLabel}
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive cursor-pointer"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Profile block at the bottom of the mobile navigation drawer. */
export function UserProfileDrawerSection({ onClose }: { onClose?: () => void }) {
  const { user, displayName, roleLabel, signOut, roleLoading } = useProfileDisplay();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-auto border-t bg-muted/30 shrink-0">
      <button
        type="button"
        disabled={roleLoading}
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors",
          "hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          expanded && "bg-muted/50",
        )}
        aria-expanded={expanded}
        aria-controls="mobile-profile-panel"
      >
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
            {initials(displayName)}
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium truncate text-foreground">{displayName}</span>
          <span className="block text-[11px] text-muted-foreground truncate">{roleLabel}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")}
        />
      </button>

      {expanded && (
        <div id="mobile-profile-panel" className="px-4 pb-4 pt-0 space-y-3 animate-in slide-in-from-top-1 fade-in-0 duration-200">
          {user?.email && (
            <p className="text-xs text-muted-foreground truncate px-0.5">{user.email}</p>
          )}
          <Badge variant="secondary" className="text-[10px] font-medium capitalize">
            {roleLabel}
          </Badge>
          <Button
            variant="outline"
            className="w-full justify-start text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              void signOut();
              onClose?.();
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
