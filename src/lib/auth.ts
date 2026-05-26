import { supabase } from "@/integrations/primary/client";

export type AppRole = "superadmin" | "owner";

export type InvitePreview = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: string;
  expires_at: string;
};

export async function getInviteByToken(token: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc("get_invite_by_token", { p_token: token });
  if (error || !data?.length) return null;
  return data[0] as InvitePreview;
}

/** True when the logged-in owner account is disabled by a super admin. */
export async function isOwnerAccountDisabled(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_my_owner_account_disabled");
  if (!error) return data === true;

  console.warn("is_my_owner_account_disabled RPC failed:", error.message);
  return false;
}

function roleBlockedForInactiveOwner(role: AppRole | null, isActive: boolean | undefined): AppRole | null {
  if (role === "owner" && isActive === false) return null;
  return role;
}

/** Resolve role via DB RPC (bypasses RLS) with client-side fallback */
export async function resolveUserRole(userId: string, email: string): Promise<AppRole | null> {
  const { data: rpcRole, error: rpcError } = await supabase.rpc("get_my_role");

  if (!rpcError) {
    return (rpcRole as AppRole) ?? null;
  }

  console.warn("get_my_role RPC failed, using fallback:", rpcError.message);

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!profileError && profile?.role) {
    return roleBlockedForInactiveOwner(profile.role as AppRole, profile.is_active as boolean | undefined);
  }

  if (email) {
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("role, is_active")
      .ilike("email", email)
      .maybeSingle();

    if (byEmail?.role) {
      return roleBlockedForInactiveOwner(byEmail.role as AppRole, byEmail.is_active as boolean | undefined);
    }
  }

  const { data: invite } = await supabase
    .from("invites")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const inviteRole = (invite?.role as AppRole) ?? null;
  if (inviteRole === "owner") {
    const disabled = await isOwnerAccountDisabled();
    if (disabled) return null;
  }

  return inviteRole;
}

export function dashboardPathForRole(role: AppRole | null): string {
  if (role === "superadmin") return "/admin";
  return "/";
}

export function formatRoleLabel(role: AppRole | null): string {
  if (role === "superadmin") return "Super Admin";
  if (role === "owner") return "Owner";
  return "User";
}

export async function fetchUserProfile(userId: string, email: string) {
  const { data: byId } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (byId?.full_name) return byId;

  if (email) {
    const { data: byEmail } = await supabase
      .from("profiles")
      .select("full_name, email")
      .ilike("email", email)
      .maybeSingle();
    if (byEmail?.full_name) return byEmail;
  }

  const fallbackName =
    email
      .split("@")[0]
      ?.replace(/[._-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "User";

  return { full_name: fallbackName, email };
}

async function sendOwnerInviteDirect(email: string, fullName: string, contactNumber: string) {
  const row: Record<string, string> = {
    email: email.trim().toLowerCase(),
    full_name: fullName.trim(),
    role: "owner",
    status: "pending",
  };
  if (contactNumber) row.contact_number = contactNumber.trim();

  let result = await supabase.from("invites").insert(row as never).select("id, token, email, full_name, role").single();

  if (result.error?.message?.includes("contact_number")) {
    const { contact_number: _, ...withoutContact } = row;
    result = await supabase.from("invites").insert(withoutContact as never).select("id, token, email, full_name, role").single();
  }

  if (result.error) throw new Error(result.error.message);
  if (!result.data?.token) throw new Error("Invite created but token missing");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    ok: true,
    inviteLink: `${origin}/accept-invite?token=${result.data.token}`,
    emailSent: false,
    invite: result.data as { id: string; email: string; full_name: string; role: AppRole },
  };
}

export async function sendOwnerInvite(email: string, fullName: string, contactNumber = "") {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.access_token) throw new Error("Not authenticated");

  const res = await supabase.functions.invoke("send-invite", {
    body: { email, full_name: fullName, contact_number: contactNumber },
  });

  if (res.data?.error) throw new Error(res.data.error);

  if (!res.error && res.data?.ok) {
    return res.data as {
      ok: boolean;
      inviteLink: string;
      emailSent: boolean;
      invite: { id: string; email: string; full_name: string; role: AppRole };
    };
  }

  if (res.error) {
    const ctx = res.error as { context?: Response };
    if (ctx.context) {
      try {
        const body = await ctx.context.json();
        if (body?.error) throw new Error(body.error);
      } catch (e) {
        if (e instanceof Error && !e.message.includes("Invite failed")) throw e;
      }
    }
    try {
      const fallback = await sendOwnerInviteDirect(email, fullName, contactNumber);
      return fallback;
    } catch (directErr) {
      const hint =
        directErr instanceof Error ? directErr.message : "Direct invite failed";
      throw new Error(
        `${hint}. Open Supabase → SQL Editor → run file: supabase/RUN_THIS_IN_SQL_EDITOR.sql`,
      );
    }
  }

  return res.data as {
    ok: boolean;
    inviteLink: string;
    emailSent: boolean;
    invite: { id: string; email: string; full_name: string; role: AppRole };
  };
}

