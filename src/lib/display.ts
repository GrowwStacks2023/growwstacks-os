// Display helpers shared by detail pages and dropdowns.

type UserLike = {
  name?: string | null;
  email?: string | null;
};

// "Best label for a user". We never want to fall back to the user id — a
// raw UUID in a dropdown is the bug this helper was added to fix. The
// `??` operator only catches null/undefined, so `u.name ?? u.email` would
// keep an empty-string name and render nothing; base-ui Select then
// displays the underlying `value` (the UUID). Treat empty/whitespace as
// missing so we always fall through to email when there's no real name.
//
// Callers pass a context-appropriate fallback (e.g. "Unassigned" on a
// dropdown placeholder vs "—" in a read-only table cell).
export function userDisplay(
  u: UserLike | null | undefined,
  fallback: string = "Unknown user"
): string {
  if (!u) return fallback;
  const name = u.name?.trim();
  if (name) return name;
  const email = u.email?.trim();
  if (email) return email;
  return fallback;
}
