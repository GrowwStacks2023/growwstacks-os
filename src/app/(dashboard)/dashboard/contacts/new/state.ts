// Initial state object for the create-contact action. Kept here (NOT in
// actions.ts) because actions.ts has the "use server" directive — that file
// can only export async functions, so plain consts must live alongside it.
import type { CreateContactState } from "./actions";

export const initialCreateContactState: CreateContactState = {
  error: null,
  contactId: null,
};
