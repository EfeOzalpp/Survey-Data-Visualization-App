import { createContext, useContext } from "react";

// STATE AUDIT (2026-08-21):
// - CALL SITES: 8 source files across 4 top-level folders — onboarding/
//   (root, useSurveySubmission), navigation/ (root, right/nav-right,
//   bottom/mode-toggle), graph-components/ (widgets/bargraph, graph-picker),
//   graph-runtime/ (dotgraph root, dotgraph/data-boundary).
// - WRAPPING: YES — the one context here that actually wraps as {children}.
//   app-provider.tsx puts <IdentityCtx.Provider> around the ENTIRE AppInner
//   tree in main.tsx: Navigation + Survey + CanvasEntry + QuestionnaireEntry
//   + CityOverlay + DataVisualization. Whole-app scope, not a subtree —
//   every feature area sits inside this provider whether or not it reads
//   identity.

// - RE-RENDER SCOPE: bundled. `identityValue` in app-provider.tsx is one
//   memoized object of all 3 fields (mySection, myEntryId, myRole); calling
//   useIdentity() anywhere re-renders on ANY of the 3 changing. e.g.
//   nav-right.tsx, which likely only cares about myRole for a label, still
//   re-renders when mySection changes post-onboarding-redirect or when
//   myEntryId is set on submit.

// - COMPARE TO THE SPLIT ALREADY DONE ELSEWHERE: ui-store/canvas-runtime-
//   store/survey-data-store were split into per-field Zustand stores
//   precisely because they have several independent fields read by several
//   unrelated consumers. Identity's 3 fields (mySection/myRole set once
//   during onboarding, myEntryId set once on submit) are the same shape of
//   problem, read by the same kind of unrelated consumers — there's no
//   structural reason for it to stay Context+bundled-object instead of a
//   Zustand store with per-field selectors; it looks like it simply hasn't
//   been migrated yet, not that it needs the wrap.
export interface IdentityState {
  // The department/section the user selected during onboarding - e.g. 'fine-arts', 'facilities'
  mySection: string | null;
  setMySection: (s: string | null) => void;
  // Sanity document _id of the user's submitted survey response - used to highlight their dot in the graph
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
