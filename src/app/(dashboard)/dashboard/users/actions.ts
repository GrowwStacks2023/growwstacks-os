"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/lib/access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Role = Database["public"]["Enums"]["user_role"];

const ROLES: ReadonlyArray<Role> = [
  "admin",
  "sales",
  "pm",
  "developer",
  "client",
];

function isRole(v: string): v is Role {
  return (ROLES as ReadonlyArray<string>).includes(v);
}

// Minimal email syntax check — Supabase will reject malformed addresses
// anyway, but we surface a friendlier error here.
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export type InviteUserResult =
  | { ok: true; userId: string; actionLink: string | null }
  | { ok: false; error: string };

// Invite a new teammate. Two-phase:
//   1. auth.admin.generateLink({ type: 'invite', ... }) — creates the
//      auth.users row, fires the handle_new_user trigger which inserts
//      the public.users row with default role 'developer', and emits the
//      invite email via Supabase's configured template/SMTP. The returned
//      `action_link` is also handed back to the UI so the admin can
//      forward it manually if SMTP isn't yet configured in the project.
//   2. UPDATE public.users SET role = <picked>, name = <picked> for the
//      new user id. Done with the admin client (RLS would otherwise
//      block this — `public.users` UPDATE is admin-only via RLS, and
//      while the caller IS admin, we already have the admin client open
//      for the auth.admin call. Reusing it keeps the action atomic and
//      avoids cookie-roundtripping.)
//
// Defense in depth: even though /dashboard/users is route-gated to
// admins, this action re-checks the caller's role from the session
// before touching anything.
export async function inviteUser(formData: FormData): Promise<InviteUserResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const roleInput = String(formData.get("role") ?? "").trim();

  if (!email) return { ok: false, error: "Email is required." };
  if (!isEmail(email)) return { ok: false, error: "Email looks invalid." };
  if (!roleInput) return { ok: false, error: "Pick a role." };
  if (!isRole(roleInput)) return { ok: false, error: "Unknown role." };

  const admin = createAdminClient();

  // Use generateLink (rather than inviteUserByEmail) so we get the
  // action_link back. Supabase still sends the invite email when its
  // email templates are enabled — the link is a secondary copy for the
  // admin to forward manually if email delivery hasn't been set up yet.
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: name ? { data: { full_name: name } } : undefined,
  });

  if (linkError || !linkData?.user) {
    return {
      ok: false,
      error:
        linkError?.message ??
        "Supabase couldn't create the invite. Check SMTP + auth settings.",
    };
  }

  const newUserId = linkData.user.id;

  // The handle_new_user trigger inserts public.users with role='developer'
  // synchronously inside the auth.users INSERT. Upsert here flips the role
  // and applies the optional name — keyed by id, so it works whether the
  // trigger ran first or there's some edge race.
  const { error: updateError } = await admin
    .from("users")
    .update({
      role: roleInput,
      name: name ? name : null,
    })
    .eq("id", newUserId);

  if (updateError) {
    // Don't leave the public.users role at 'developer' silently.
    return {
      ok: false,
      error: `User created, but couldn't apply role: ${updateError.message}`,
    };
  }

  // Audit. Non-fatal — the invite succeeded even if logging didn't.
  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  await supabase
    .from("activity_log")
    .insert({
      entity_type: "user",
      entity_id: newUserId,
      action: "invite_user",
      actor_id: actor?.id ?? null,
      after_state: { email, role: roleInput },
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/users");

  return {
    ok: true,
    userId: newUserId,
    actionLink: linkData.properties?.action_link ?? null,
  };
}

export type ResendInviteResult =
  | { ok: true; actionLink: string | null }
  | { ok: false; error: string };

// Re-send the password-reset/invite link for an existing user. Used when
// the original email got lost or the admin needs to forward the link
// manually. We use type:'recovery' which works for both already-confirmed
// users and pending-invite users.
export async function resendInvite(userId: string): Promise<ResendInviteResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  // Look up the email by id — generateLink wants email, not id.
  const { data: row, error: lookupError } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (lookupError || !row?.email) {
    return { ok: false, error: "User not found." };
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email: row.email,
    });

  if (linkError || !linkData) {
    return {
      ok: false,
      error: linkError?.message ?? "Couldn't generate a recovery link.",
    };
  }

  return {
    ok: true,
    actionLink: linkData.properties?.action_link ?? null,
  };
}
