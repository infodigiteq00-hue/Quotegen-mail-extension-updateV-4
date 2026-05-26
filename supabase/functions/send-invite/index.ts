import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const appUrl = (Deno.env.get("APP_URL") || "http://localhost:8080").replace(/\/$/, "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    let isSuperadmin = false;
    const { data: profileById } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileById?.role === "superadmin") {
      isSuperadmin = true;
    } else if (userData.user.email) {
      const { data: profileByEmail } = await admin
        .from("profiles")
        .select("role")
        .ilike("email", userData.user.email)
        .maybeSingle();
      isSuperadmin = profileByEmail?.role === "superadmin";
    }

    if (!isSuperadmin) {
      return json({
        error: "Only superadmin can send invites. Add your user to profiles with role superadmin (see seed_superadmin.sql).",
      }, 403);
    }

    const body = await req.json();
    const resend = Boolean(body.resend);
    const inviteId = body.invite_id as string | undefined;
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || body.fullName || "").trim();
    const contactNumber = String(body.contact_number || body.contactNumber || "").trim();

    let invite: { id: string; token: string; email: string; full_name: string; role: string } | null = null;

    if (resend && inviteId) {
      const { data: existing, error: fetchErr } = await admin
        .from("invites")
        .select("id, token, email, full_name, role, status")
        .eq("id", inviteId)
        .maybeSingle();

      if (fetchErr || !existing) return json({ error: "Invite not found" }, 404);

      const { data: updated, error: updateErr } = await admin
        .from("invites")
        .update({
          status: "pending",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .select("id, token, email, full_name, role")
        .single();

      if (updateErr || !updated) return json({ error: updateErr?.message || "Failed to resend" }, 500);
      invite = updated;
    } else {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: "Valid email is required" }, 400);
      }
      if (!fullName) {
        return json({ error: "Full name is required" }, 400);
      }

      const { data: existingPending } = await admin
        .from("invites")
        .select("id")
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (existingPending) {
        return json({ error: "A pending invite already exists for this email" }, 409);
      }

      const baseRow = {
        email,
        full_name: fullName,
        role: "owner",
        invited_by: userData.user.id,
        status: "pending",
      };

      let insertResult = await admin
        .from("invites")
        .insert({ ...baseRow, contact_number: contactNumber })
        .select("id, token, email, full_name, role")
        .single();

      if (insertResult.error?.message?.includes("contact_number")) {
        insertResult = await admin
          .from("invites")
          .insert(baseRow)
          .select("id, token, email, full_name, role")
          .single();
      }

      if (insertResult.error || !insertResult.data) {
        const msg = insertResult.error?.message || "Failed to create invite";
        if (msg.includes("relation") && msg.includes("invites")) {
          return json({
            error: "invites table missing. Run supabase/RUN_THIS_IN_SQL_EDITOR.sql in Supabase SQL Editor.",
          }, 500);
        }
        return json({ error: msg }, 500);
      }
      invite = insertResult.data;
    }

    if (!invite) return json({ error: "Invite missing" }, 500);

    const inviteLink = `${appUrl}/accept-invite?token=${invite.token}`;

    const resendKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    const recipientEmail = invite.email;
    const recipientName = invite.full_name;

    if (resendKey) {
      const from = Deno.env.get("INVITE_FROM_EMAIL") || "onboarding@resend.dev";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [recipientEmail],
          subject: "You're invited to QuoteGen",
          html: `
            <p>Hello ${recipientName},</p>
            <p>You have been invited to join QuoteGen as <strong>${invite.role}</strong>.</p>
            <p><strong>Email:</strong> ${recipientEmail}</p>
            <p><a href="${inviteLink}">Accept your invitation</a></p>
            <p>This link expires in 7 days.</p>
          `,
        }),
      });
      emailSent = res.ok;
    }

    return json({
      ok: true,
      invite: {
        id: invite.id,
        email: invite.email,
        full_name: invite.full_name,
        role: invite.role,
      },
      inviteLink,
      emailSent,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Server error" }, 500);
  }
});
