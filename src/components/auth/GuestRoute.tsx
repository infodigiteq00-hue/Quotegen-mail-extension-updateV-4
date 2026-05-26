import { Navigate } from "react-router-dom";
import { useAuth, dashboardPathForRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading, roleLoading } = useAuth();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && role) {
    return <Navigate to={dashboardPathForRole(role)} replace />;
  }

  return <>{children}</>;
}
