"use server";

import { revalidatePath } from "next/cache";

import { getCurrentRole } from "@/lib/access-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Role = Database["public"]["Enums"]["user_role"];
type AdminClient = ReturnType<typeof createAdminClient>;

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

// Where the invite link drops the user after they click it. Currently
// hardcoded to the deployed URL with a NEXT_PUBLIC_SITE_URL override; the
// actual /auth/callback route doesn't exist yet (Task 23 will build it).
// Until it does, Supabase's project-level Site URL setting is the
// effective fallback.
//
// TODO: make this fully env-driven when we add a staging environment so
// each deploy can target its own redirect — for now one prod URL is fine.
function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://growwstacks-os.vercel.app"
  );
}

// Poll public.users until the row created by the handle_new_user trigger
// is visible to PostgREST. The trigger fires synchronously inside the
// auth.users INSERT, but on managed Supabase the GoTrue admin call and
// our subsequent PostgREST UPDATE can land on different pooled
// connections — and the second connection occasionally doesn't see the
// just-committed row instantly. Without this wait, the UPDATE below
// matches zero rows silently (no error returned) and the role stays at
// the trigger's 'developer' default. 5 × 200ms = up to 1 s.
async function waitForPublicUser(
  id: string,
  admin: AdminClient
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data } = await admin
      .from("users")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (data) return true;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return false;
}

export type InviteUserResult =
  | { ok: true; userId: string; actionLink: string | null }
  | { ok: false; error: string };

// Invite a new teammate.
//
// Send method: inviteUserByEmail — same call the Supabase dashboard's
// "Send invite" button uses. It creates the auth.users row AND enqueues
// the invite email through the project's configured SMTP.
//
// Why the role UPDATE goes through the admin's SESSION client (not the
// service-role admin client): there is a BEFORE-UPDATE trigger on
// public.users (`enforce_user_self_update`) that calls
// `current_user_role()`. That function reads `auth.uid()`. With the
// service-role admin client, `auth.uid()` is NULL → `current_user_role()`
// returns NULL → the trigger's `IF caller_role = 'admin'` is NULL →
// falls through and RAISES "role can only be changed by an admin" on
// any role-changing UPDATE. The admin's session client carries their
// auth.uid() so `current_user_role()` evaluates to 'admin' and the
// trigger early-returns. RLS on public.users.update also passes
// (current_user_role()='admin' OR id=auth.uid()).
//
// Order of operations:
//   1. Re-check the caller is admin.
//   2. Validate email + role input.
//   3. inviteUserByEmail (admin client) → GoTrue creates auth.users +
//      sends email + the handle_new_user trigger inserts public.users
//      with default role='developer'.
//   4. waitForPublicUser (admin client) → poll until the trigger's row
//      is visible to PostgREST.
//   5. UPDATE public.users via SESSION client → satisfies the trigger.
//   6. Verify: SELECT the row, confirm role equals what we asked for.
//      If it doesn't, raise a clear error rather than returning silent
//      success.
//   7. activity_log insert (non-fatal).
//   8. revalidatePath + return.
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

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: name ? { full_name: name } : undefined,
      redirectTo: `${siteUrl()}/auth/callback`,
    });

  if (inviteError || !invited?.user) {
    return {
      ok: false,
      error:
        inviteError?.message ??
        "Supabase couldn't send the invite. Check SMTP + auth settings.",
    };
  }

  const newUserId = invited.user.id;

  const visible = await waitForPublicUser(newUserId, admin);
  if (!visible) {
    return {
      ok: false,
      error:
        "User was created in Auth, but their profile row didn't appear in time. " +
        "Check Supabase Studio for the auth.users row and fix the role manually.",
    };
  }

  // Session client — runs as the admin per auth.uid(), so the trigger
  // and RLS both let the role change through.
  const supabase = await createClient();

  const { error: updateError } = await supabase
    .from("users")
    .update({
      role: roleInput,
      name: name ? name : null,
    })
    .eq("id", newUserId);

  if (updateError) {
    return {
      ok: false,
      error: `User invited, but couldn't apply role: ${updateError.message}`,
    };
  }

  // Verify the role actually landed. Closes the "trigger silently
  // reverted the role" failure mode — if our write was rejected for any
  // reason we don't lose the signal.
  const { data: verified, error: verifyError } = await supabase
    .from("users")
    .select("role")
    .eq("id", newUserId)
    .maybeSingle();

  if (verifyError || !verified) {
    return {
      ok: false,
      error: `User invited, but couldn't verify role assignment: ${
        verifyError?.message ?? "row not found"
      }`,
    };
  }

  if (verified.role !== roleInput) {
    return {
      ok: false,
      error: `User invited, but role landed as '${verified.role}' instead of '${roleInput}'. Check Supabase logs and fix manually.`,
    };
  }

  // Audit. Non-fatal — the invite succeeded even if logging didn't.
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
    // inviteUserByEmail doesn't return an action_link — the email is the
    // sole delivery channel.
    actionLink: null,
  };
}

export type ResendInviteResult =
  | { ok: true; actionLink: string | null }
  | { ok: false; error: string };

// Re-send the invite email. Supabase's JS SDK doesn't have a dedicated
// "resend invite" admin method — calling inviteUserByEmail for the same
// email re-sends a fresh link for users who haven't confirmed yet. For
// users who already accepted the invite and set a password, Supabase
// returns a "User already registered" error; the right tool for them is
// a password reset (a future feature), not a resend-invite.
export async function resendInvite(userId: string): Promise<ResendInviteResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }

  const admin = createAdminClient();

  const { data: row, error: lookupError } = await admin
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (lookupError || !row?.email) {
    return { ok: false, error: "User not found." };
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    row.email,
    {
      redirectTo: `${siteUrl()}/auth/callback`,
    }
  );

  if (inviteError) {
    return {
      ok: false,
      error: inviteError.message,
    };
  }

  return {
    ok: true,
    actionLink: null,
  };
}

// ─── Deactivate / Reactivate ───────────────────────────────────────────
// Soft on/off switch. Inactive users:
//   - Get bounced by the middleware deactivation gate on every request.
//   - Cannot sign in (their session is forced-revoked the next time it
//     tries to refresh).
//
// The UPDATE goes through the admin's session client for the same
// reason the role UPDATE does (see inviteUser comment): the
// enforce_user_self_update trigger checks current_user_role() which
// reads auth.uid(). Service-role JWT has no auth.uid() → trigger
// raises "is_active can only be changed by an admin".

export type DeactivateUserResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deactivateUser(
  userId: string
): Promise<DeactivateUserResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }

  if (!userId) return { ok: false, error: "Missing user id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) return { ok: false, error: "You must be signed in." };
  if (actor.id === userId) {
    return {
      ok: false,
      error: "You can't deactivate yourself. Ask another admin to do it.",
    };
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      is_active: false,
      deactivated_at: new Date().toISOString(),
      deactivated_by: actor.id,
    })
    .eq("id", userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  // Force-revoke any active session for the deactivated user. This
  // doesn't log them out immediately if they're mid-request, but the
  // next call that hits the middleware (which checks is_active) will
  // bounce them anyway. The signOut call here is belt-and-braces so a
  // long-lived session token can't refresh on the next round-trip.
  const admin = createAdminClient();
  await admin.auth.admin
    .signOut(userId)
    .catch(() => undefined);

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "user",
      entity_id: userId,
      action: "deactivate_user",
      actor_id: actor.id,
      after_state: { is_active: false },
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/users");

  return { ok: true };
}

export type ReactivateUserResult =
  | { ok: true }
  | { ok: false; error: string };

export async function reactivateUser(
  userId: string
): Promise<ReactivateUserResult> {
  const role = await getCurrentRole();
  if (role !== "admin") {
    return { ok: false, error: "Not authorized." };
  }
  if (!userId) return { ok: false, error: "Missing user id." };

  const supabase = await createClient();
  const {
    data: { user: actor },
  } = await supabase.auth.getUser();
  if (!actor) return { ok: false, error: "You must be signed in." };

  const { error: updateError } = await supabase
    .from("users")
    .update({
      is_active: true,
      deactivated_at: null,
      deactivated_by: null,
    })
    .eq("id", userId);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await supabase
    .from("activity_log")
    .insert({
      entity_type: "user",
      entity_id: userId,
      action: "reactivate_user",
      actor_id: actor.id,
      after_state: { is_active: true },
    })
    .then(() => undefined, () => undefined);

  revalidatePath("/dashboard/users");

  return { ok: true };
}
