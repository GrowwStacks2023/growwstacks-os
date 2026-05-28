import type { AttachmentEntityType } from "./actions";

// Keep the original extension but strip exotic characters from the rest of
// the name so the resulting Storage path stays URL-safe.
export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "-");
}

// Storage layout: <entity_type>/<entity_id>/<timestamp>-<sanitized name>.
// The timestamp prefix prevents collisions when the same filename is
// uploaded twice; grouping by entity is just human-friendly browsing in
// the Supabase Storage UI.
export function storagePathFor(
  entityType: AttachmentEntityType,
  entityId: string,
  fileName: string
): string {
  return `${entityType}/${entityId}/${Date.now()}-${sanitizeFileName(fileName)}`;
}
