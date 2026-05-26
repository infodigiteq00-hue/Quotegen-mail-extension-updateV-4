import { ShieldOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function DisabledAccountScreen() {
  const { signOut, profileName, user } = useAuth();
  const displayEmail = user?.email ?? "";

  return (
    <AuthLayout
      title="Account disabled"
      subtitle="Your workspace access has been suspended"
    >
      <div className="space-y-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldOff className="h-7 w-7" />
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            {profileName ? (
              <>
                Hi <span className="font-medium text-foreground">{profileName}</span>,
              </>
            ) : null}{" "}
            your owner account has been disabled by a super admin.
          </p>
          <p>You cannot access the dashboard, quotations, or other protected features until your account is re-enabled.</p>
          {displayEmail ? (
            <p className="text-xs">
              Signed in as <span className="font-medium text-foreground">{displayEmail}</span>
            </p>
          ) : null}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            void signOut();
          }}
        >
          Sign out
        </Button>
      </div>
    </AuthLayout>
  );
}
