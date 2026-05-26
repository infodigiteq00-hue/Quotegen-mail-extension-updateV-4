import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createOwnerInvite,
  deleteOwnerInvite,
  fetchOwnerStats,
  fetchOwners,
  resendOwnerInvite,
  setOwnerAccountActive,
  updateOwnerInvite,
  type OwnerRow,
  type OwnerStats,
} from "@/lib/ownerAdmin";
import {
  Clock,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Send,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

function StatusBadge({ active, label }: { active: boolean; label?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium border transition-colors",
        active
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/15"
          : "bg-red-500/10 text-red-700 border-red-500/30 hover:bg-red-500/15",
      )}
    >
      {label ?? (active ? "Active" : "Inactive")}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  title: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="group border-border/60 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
          <div
            className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105",
              accent,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FormState = { full_name: string; email: string; contact_number: string };

const emptyForm: FormState = { full_name: "", email: "", contact_number: "" };

export default function SuperadminDashboard() {
  const [stats, setStats] = useState<OwnerStats>({ totalUsers: 0, activeUsers: 0, pendingInvites: 0 });
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editing, setEditing] = useState<OwnerRow | null>(null);
  const [deleting, setDeleting] = useState<OwnerRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([fetchOwnerStats(), fetchOwners()]);
      setStats(s);
      setOwners(list);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inviteStatus = (row: OwnerRow) => row.status === "accepted";

  const accountStatus = (row: OwnerRow) => {
    if (!row.user_id) return { active: false, label: "Inactive" as const };
    if (row.profile?.is_active === false) return { active: false, label: "Inactive" as const };
    return { active: true, label: "Active" as const };
  };

  const onInviteSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const result = await createOwnerInvite(form);
      toast.success(result.emailSent ? "Invitation sent" : "Owner invited");
      if (!result.emailSent && result.inviteLink) {
        await navigator.clipboard.writeText(result.inviteLink);
        toast.message("Invite link copied to clipboard");
      }
      setInviteOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setSubmitting(false);
    }
  };

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSubmitting(true);
    try {
      await updateOwnerInvite(editing.id, form);
      toast.success("Owner updated");
      setEditOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (row: OwnerRow) => {
    setEditing(row);
    setForm({
      full_name: row.full_name,
      email: row.email,
      contact_number: row.contact_number || "",
    });
    setEditOpen(true);
  };

  const handleDisable = async (row: OwnerRow) => {
    if (!row.user_id) {
      toast.error("Owner must complete signup before enabling/disabling account");
      return;
    }
    const isCurrentlyActive = row.profile?.is_active !== false;
    const nextActive = !isCurrentlyActive;
    setActionId(row.id);
    try {
      await setOwnerAccountActive(row.user_id, nextActive);
      toast.success(nextActive ? "Account enabled" : "Account disabled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionId(null);
    }
  };

  const handleResend = async (row: OwnerRow) => {
    setActionId(row.id);
    try {
      const result = await resendOwnerInvite(row.id);
      toast.success(result.emailSent ? "Invite resent" : "Invite refreshed");
      if (!result.emailSent && result.inviteLink) {
        await navigator.clipboard.writeText(result.inviteLink);
        toast.message("Invite link copied");
      }
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setSubmitting(true);
    try {
      await deleteOwnerInvite(deleting.id);
      toast.success("Owner removed");
      setDeleteOpen(false);
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSubmitting(false);
    }
  };

  const statCards = useMemo(
    () => [
      {
        title: "Total users",
        value: stats.totalUsers,
        hint: "All owner invitations",
        icon: Users,
        accent: "bg-blue-500/10 text-blue-600",
      },
      {
        title: "Active users",
        value: stats.activeUsers,
        hint: "Signed up & enabled",
        icon: UserCheck,
        accent: "bg-emerald-500/10 text-emerald-600",
      },
      {
        title: "Pending invites",
        value: stats.pendingInvites,
        hint: "Awaiting acceptance",
        icon: Clock,
        accent: "bg-amber-500/10 text-amber-600",
      },
    ],
    [stats],
  );

  const OwnerForm = ({ onSubmit, submitLabel }: { onSubmit: (e: FormEvent) => void; submitLabel: string }) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="owner-name">Owner name</Label>
        <Input
          id="owner-name"
          placeholder="Jane Smith"
          value={form.full_name}
          onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-email">Email ID</Label>
        <Input
          id="owner-email"
          type="email"
          placeholder="owner@company.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-contact">Contact number</Label>
        <Input
          id="owner-contact"
          type="tel"
          placeholder="+91 98765 43210"
          value={form.contact_number}
          onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
          required
        />
      </div>
      <DialogFooter className="gap-2 sm:gap-0 pt-2">
        <Button type="button" variant="outline" onClick={() => (inviteOpen ? setInviteOpen(false) : setEditOpen(false))}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="min-w-[120px]">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );

  return (
    <AppShell>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Administration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Owner management</h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              Invite owners, track invitations, and manage account access from one place.
            </p>
          </div>
          <Button
            size="lg"
            className="shadow-md hover:shadow-lg transition-shadow"
            onClick={() => {
              setForm(emptyForm);
              setInviteOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite owner
          </Button>
        </header>

        <section className="grid gap-4 sm:grid-cols-3">
          {statCards.map((card) => (
            <StatCard key={card.title} {...card} />
          ))}
        </section>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Owners</CardTitle>
            <CardDescription>Manage invited owners and their account status</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:px-6 sm:pb-6">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : owners.length === 0 ? (
              <div className="text-center py-16 px-4">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No owners yet. Click &quot;Invite owner&quot; to add one.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border mx-4 sm:mx-0 mb-4 sm:mb-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Owner name</TableHead>
                      <TableHead>Email ID</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Invite status</TableHead>
                      <TableHead>Account status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {owners.map((row) => {
                      const acct = accountStatus(row);
                      const busy = actionId === row.id;
                      return (
                        <TableRow key={row.id} className="group transition-colors">
                          <TableCell className="font-medium">{row.full_name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Mail className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              {row.email}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3.5 w-3.5 shrink-0 opacity-60" />
                              {row.contact_number || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge active={inviteStatus(row)} />
                          </TableCell>
                          <TableCell>
                            <StatusBadge active={acct.active} label={acct.label} />
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(row.created_at), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1 opacity-90 group-hover:opacity-100">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10"
                                title="Edit"
                                onClick={() => openEdit(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-amber-500/10"
                                title={row.profile?.is_active === false ? "Enable" : "Disable"}
                                disabled={busy || !row.user_id}
                                onClick={() => void handleDisable(row)}
                              >
                                {busy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : row.profile?.is_active === false ? (
                                  <UserCheck className="h-4 w-4" />
                                ) : (
                                  <UserX className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-blue-500/10"
                                title="Resend invite"
                                disabled={busy || row.status === "accepted"}
                                onClick={() => void handleResend(row)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 text-destructive"
                                title="Delete"
                                onClick={() => {
                                  setDeleting(row);
                                  setDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite owner</DialogTitle>
            <DialogDescription>
              An invitation email will be sent. The owner must accept, sign up, and confirm email before logging in.
            </DialogDescription>
          </DialogHeader>
          <OwnerForm onSubmit={onInviteSubmit} submitLabel="Send invite" />
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit owner</DialogTitle>
            <DialogDescription>Update owner details stored on the invitation.</DialogDescription>
          </DialogHeader>
          <OwnerForm onSubmit={onEditSubmit} submitLabel="Save changes" />
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete owner?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{deleting?.full_name}</strong> from the invite list. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
              disabled={submitting}
            >
              {submitting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
