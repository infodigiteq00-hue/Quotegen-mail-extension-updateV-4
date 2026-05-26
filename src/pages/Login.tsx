import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/primary/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, dashboardPathForRole } from "@/contexts/AuthContext";
import { isOwnerAccountDisabled } from "@/lib/auth";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();
  const { user, role, loading, refreshRole, accountDisabled } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && accountDisabled) {
      navigate("/account-disabled", { replace: true });
      return;
    }
    if (!loading && user && role) {
      navigate(dashboardPathForRole(role), { replace: true });
    }
  }, [user, role, accountDisabled, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (!data.session) {
        toast.error("Sign-in succeeded but session was not created. Try again.");
        return;
      }

      const resolved = await refreshRole(data.user);
      const disabled = await isOwnerAccountDisabled();
      if (disabled) {
        navigate("/account-disabled", { replace: true });
        return;
      }
      const path = dashboardPathForRole(resolved);
      if (!resolved) {
        toast.error(
          "Profile not linked to this login. In Supabase SQL Editor run migration 20260519160000_get_my_role.sql or sync profile id with auth.users id.",
        );
        await supabase.auth.signOut();
        return;
      }
      toast.success("Welcome back!");
      navigate(path, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Access your QuoteGen workspace">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground text-center mt-4">
        Invited by your admin?{" "}
        <Link to="/accept-invite" className="text-primary underline-offset-4 hover:underline">
          Accept invitation
        </Link>
      </p>
    </AuthLayout>
  );
}
