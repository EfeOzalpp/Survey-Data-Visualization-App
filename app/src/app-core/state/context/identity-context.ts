import { createContext, useContext } from "react";

// STATE AUDIT (2026-08-21):

export interface IdentityState {
  // The department/section the user selected during onboarding - e.g. 'fine-arts', 'facilities'
  mySection: string | null;
  setMySection: (s: string | null) => void;
  // Postgres row id (`_id` on the survey response) of the user's submitted response -
  // drives their personal highlight in the dot graph, bar graph percentile, and mode-toggle score
  myEntryId: string | null;
  setMyEntryId: (id: string | null) => void;
  // Role selected during onboarding - 'student', 'staff', or 'visitor'
  myRole: string | null;
  setMyRole: (r: string | null) => void;
};

export const IdentityCtx = createContext<IdentityState | null>(null);

export function useIdentity(): IdentityState {
  const ctx = useContext(IdentityCtx);
  if (!ctx) throw new Error("useIdentity must be used within AppProvider");
  return ctx;
}
