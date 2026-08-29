// src/graph-runtime/gamification/gamification-personal/usePersonalizedPanelUi.ts
// The context + store consumer piece pulled out of GamificationPersonalized:
// syncing this panel's open/closed state with the app-wide ui-store
// (openPersonalized).
import { useEffect, useState } from 'react';

import { useUiStore } from "../../../app-core/state/stores/ui-store";

export function usePersonalizedPanelUi(onOpenChange?: (open: boolean) => void) {
  const openPersonalized = useUiStore((s) => s.openPersonalized);
  const setOpenPersonalized = useUiStore((s) => s.setOpenPersonalized);

  const [open, setOpen] = useState(true);

  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);

  useEffect(() => {
    if (!openPersonalized) return;
    const timerId = window.setTimeout(() => {
      setOpen(true);
    }, 0);
    setOpenPersonalized(false);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [openPersonalized, setOpenPersonalized]);

  return { open, setOpen };
}
