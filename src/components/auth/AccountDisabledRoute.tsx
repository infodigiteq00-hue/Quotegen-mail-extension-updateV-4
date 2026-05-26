import { Navigate } from "react-router-dom";
import { useAuth, dashboardPathForRole } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { DisabledAccountScreen } from "@/components/auth/DisabledAccountScreen";

export function AccountDisabledRoute() {
  const { user, loading, roleLoading, role, accountDisabled } = useAuth();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!accountDisabled && role) {
    return <Navigate to={dashboardPathForRole(role)} replace />;
  }

  if (!accountDisabled && !role) {
    return <Navigate to="/login" state={{ reason: "no-role" }} replace />;
  }

  return <DisabledAccountScreen />;
}
