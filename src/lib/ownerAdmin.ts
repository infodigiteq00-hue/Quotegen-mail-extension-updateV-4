import { supabase } from "@/integrations/primary/client";
import { sendOwnerInvite } from "@/lib/auth";

export type OwnerRow = {
  id: string;
  email: string;
  full_name: string;
  contact_number: string;
  status: string;
  user_id: string | null;
  created_at: string;
  profile?: { is_active: boolean } | null;
};

export type OwnerStats = {
  totalUsers: number;
  activeUsers: number;
  pendingInvites: number;
};

async function selectInvites(columns: string) {
  const base = () =>
    supabase
      .from("invites")
      .select(columns)
      .eq("role", "owner")
      .order("created_at", { ascending: false });

  const res = await base();
  if (res.error && columns.includes("contact_number")) {
    return supabase
      .from("invites")
      .select("id, email, full_name, status, user_id, created_at")
      .eq("role", "owner")
      .order("created_at", { ascending: false });
  }
  return res;
}

async function selectOwnerProfiles() {
  const withActive = await supabase.from("profiles").select("id, is_active").eq("role", "owner");
  if (!withActive.error) return withActive;

  return supabase.from("profiles").select("id").eq("role", "owner");
}

export async function fetchOwnerStats(): Promise<OwnerStats> {
  const [invitesRes, profilesRes] = await Promise.all([
    supabase.from("invites").select("status").eq("role", "owner"),
    selectOwnerProfiles(),
  ]);

  if (invitesRes.error) {
    throw new Error(invitesRes.error.message || "Could not load invites. Run migration 20260519170000_fix_is_superadmin.sql in Supabase.");
  }
  if (profilesRes.error) {
    throw new Error(profilesRes.error.message || "Could not load profiles.");
  }

  const invites = invitesRes.data ?? [];
  const profiles = profilesRes.data ?? [];

  return {
    totalUsers: invites.length,
    activeUsers: profiles.filter((p) => ("is_active" in p ? p.is_active !== false : true)).length,
    pendingInvites: invites.filter((i) => i.status === "pending").length,
  };
}

export async function fetchOwners(): Promise<OwnerRow[]> {
  const { data, error } = await selectInvites(
    "id, email, full_name, contact_number, status, user_id, created_at",
  );

  if (error) {
    throw new Error(error.message || "Could not load owners. Run migration 20260519170000_fix_is_superadmin.sql in Supabase.");
  }

  const owners = ((data ?? []) as Omit<OwnerRow, "contact_number">[]).map((o) => ({
    ...o,
    contact_number: ("contact_number" in o ? (o as OwnerRow).contact_number : "") ?? "",
  }));

  const userIds = owners.map((o) => o.user_id).filter(Boolean) as string[];

  if (userIds.length === 0) {
    return owners.map((o) => ({ ...o, profile: null }));
  }

  const profilesRes = await selectOwnerProfiles();
  if (profilesRes.error) throw profilesRes.error;

  const map = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id,
      { is_active: "is_active" in p ? (p.is_active as boolean) : true },
    ]),
  );

  return owners.map((o) => ({
    ...o,
    profile: o.user_id ? map.get(o.user_id) ?? { is_active: true } : null,
  }));
}

export async function createOwnerInvite(payload: {
  full_name: string;
  email: string;
  contact_number: string;
}) {
  return sendOwnerInvite(payload.email, payload.full_name, payload.contact_number);
}

export async function updateOwnerInvite(
  id: string,
  payload: { full_name: string; email: string; contact_number: string },
) {
  const updatePayload: Record<string, string> = {
    full_name: payload.full_name,
    email: payload.email.trim().toLowerCase(),
    updated_at: new Date().toISOString(),
  };
  if (payload.contact_number) updatePayload.contact_number = payload.contact_number;

  const { error } = await supabase.from("invites").update(updatePayload as never).eq("id", id);
  if (error) throw error;

  const { data: invite } = await supabase.from("invites").select("user_id").eq("id", id).single();
  if (invite?.user_id) {
    const profileUpdate: Record<string, string> = {
      full_name: payload.full_name,
      email: payload.email.trim().toLowerCase(),
      updated_at: new Date().toISOString(),
    };
    if (payload.contact_number) profileUpdate.contact_number = payload.contact_number;
    await supabase.from("profiles").update(profileUpdate as never).eq("id", invite.user_id);
  }
}

export async function setOwnerAccountActive(
  userId: string | null,
  active: boolean,
  ownerEmail?: string,
) {
  if (!userId) throw new Error("Owner has not completed signup yet");

  const { data: updated, error } = await supabase
    .from("profiles")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id");

  if (error) throw error;

  if ((updated?.length ?? 0) === 0 && ownerEmail) {
    const { error: byEmailError } = await supabase
      .from("profiles")
      .update({ is_active: active, updated_at: new Date().toISOString() })
      .ilike("email", ownerEmail.trim().toLowerCase())
      .eq("role", "owner");
    if (byEmailError) throw byEmailError;
  }
}

export async function deleteOwnerInvite(id: string) {
  const { error } = await supabase.from("invites").delete().eq("id", id);
  if (error) throw error;
}

export async function resendOwnerInvite(inviteId: string) {
  const res = await supabase.functions.invoke("send-invite", {
    body: { invite_id: inviteId, resend: true },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data as { ok: boolean; emailSent: boolean; inviteLink?: string };
}
