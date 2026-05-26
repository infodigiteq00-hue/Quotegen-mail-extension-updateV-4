import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/primary/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getInviteByToken, type InvitePreview } from "@/lib/auth";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Signup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getInviteByToken(token).then((row) => {
      setInvite(row);
      setLoading(false);
    });
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!invite) return;
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: invite.full_name,
            invite_token: token,
          },
        },
      });
      if (error) throw error;
      setDone(true);
      toast.success("Check your email to confirm your account before signing in.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AuthLayout title="Preparing signup">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (!token || !invite) {
    return (
      <AuthLayout title="Invalid invitation" subtitle="Use the link from your invite email to sign up.">
        <Button asChild variant="outline" className="w-full">
          <Link to="/accept-invite">Enter invitation</Link>
        </Button>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${invite.email}. After confirming, sign in to access your owner dashboard.`}
      >
        <Button className="w-full" onClick={() => navigate("/login")}>
          Go to login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Create your account" subtitle={`Signing up as ${invite.role} · ${invite.full_name}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={invite.email} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Sign up"}
        </Button>
      </form>
    </AuthLayout>
  );
}
