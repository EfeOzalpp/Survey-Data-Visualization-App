// src/graph-runtime/dotgraph/scope/useViewerScope.ts

import { useMemo } from "react";
import {
  ROLE,
  normSection,
  deriveRoleFromSectionId,
  allowPersonalInSection,
} from "./scoping";
import { getSessionItem } from "../../../app-core/session";

interface UseViewerScopeArgs {
  mySection: string | null | undefined;
  section: string | null | undefined;
}

export default function useViewerScope(args: UseViewerScopeArgs) {
  const { mySection, section } = args;

  const effectiveMySection = useMemo(() => {
    if (mySection && mySection !== "") return mySection;
    const s = getSessionItem("be.mySection");
    if (s && s !== "") return s;
    return "";
  }, [mySection]);

  const viewerRole = useMemo(
    () => deriveRoleFromSectionId(effectiveMySection),
    [effectiveMySection]
  );

  const shouldShowPersonalized = useMemo(() => {
    const viewing =
      section ??
      getSessionItem("be.viewingSection") ??
      "all";

    const ok = allowPersonalInSection(viewerRole, effectiveMySection, viewing);

    // Visitors only in Everyone/Visitors contexts.
    if (viewerRole === ROLE.VISITOR) {
      const v = normSection(viewing);
      return v === "all" || v === "visitor";
    }
    return ok;
  }, [viewerRole, effectiveMySection, section]);

  return {
    effectiveMySection,
    viewerRole,
    shouldShowPersonalized,
  };
}
