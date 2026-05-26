import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getInviteByToken, type InvitePreview } from "@/lib/auth";
import { Loader2, Mail, User } from "lucide-react";

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Missing invitation token. Open the link from your invite email.");
      setLoading(false);
      return;
    }
    getInviteByToken(token).then((row) => {
      if (!row) setError("This invitation is invalid or has expired.");
      else setInvite(row);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <AuthLayout title="Checking invitation">
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AuthLayout>
    );
  }

  if (error || !invite) {
    return (
      <AuthLayout title="Invitation unavailable" subtitle={error || undefined}>
        <Button asChild variant="outline" className="w-full">
          <Link to="/login">Back to login</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="You're invited" subtitle="Review your details and continue to create your account">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/40">
          <User className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Name</p>
            <p className="font-medium">{invite.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/40">
          <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Email</p>
            <p className="font-medium">{invite.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Role</span>
          <Badge variant="secondary" className="capitalize">
            {invite.role}
          </Badge>
        </div>
        <Button className="w-full" onClick={() => navigate(`/signup?token=${token}`)}>
          Accept & create account
        </Button>
      </div>
    </AuthLayout>
  );
}
