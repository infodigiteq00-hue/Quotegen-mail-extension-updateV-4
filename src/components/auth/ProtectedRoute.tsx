import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: ("superadmin" | "owner")[];
}) {
  const { user, loading, role, roleLoading, accountDisabled } = useAuth();
  const location = useLocation();

  if (loading || (user && roleLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-mesh">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accountDisabled) {
    return <Navigate to="/account-disabled" replace />;
  }

  if (!roleLoading && !role) {
    return <Navigate to="/login" state={{ from: location, reason: "no-role" }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={role === "superadmin" ? "/admin" : "/"} replace />;
  }

  return <>{children}</>;
}
