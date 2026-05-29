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
// the invite email through the project's configured SMTP. The earlier
// generateLink path was the Task 22 bug: it returned a usable link but
// did not reliably trigger the email.
//
// Order of operations:
//   1. Re-check the caller is admin (defense in depth; the page is
//      already route-gated).
//   2. Validate email + role input.
//   3. inviteUserByEmail → GoTrue creates auth.users + sends email +
//      the handle_new_user trigger inserts public.users with default
//      role='developer'.
//   4. waitForPublicUser → poll until our PostgREST connection sees the
//      trigger's row. Avoids the race where UPDATE matches zero rows.
//   5. UPDATE public.users → apply chosen role + name via the admin
//      client (bypasses RLS).
//   6. activity_log insert (non-fatal).
//   7. revalidatePath + return.
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

  const { error: updateError } = await admin
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
    // inviteUserByEmail doesn't return an action_link — the email is the
    // sole delivery channel. The success UI handles actionLink: null
    // by simply not showing the fallback-link block.
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
