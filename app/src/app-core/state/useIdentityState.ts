// STATE AUDIT (2026-08-21):
// Not independently called elsewhere — this is private to app-provider.tsx,
// which is the only importer. It owns the raw useState + sessionStorage-sync
// logic that identity-context.ts's bundled `identityValue` object is built
// from. The "call sites / wrapping / re-render" questions apply to
// identity-context.ts (the public surface), not here — see the audit note
// there for why this ends up bundled and whole-app-scoped downstream.
import { startTransition, useEffect, useState } from 'react';

import { getSessionItem } from '../session';

export default function useIdentityState() {
  const [mySection, setMySection] = useState<string | null>(null);
  const [myEntryId, setMyEntryId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    const onStorageSync = () => {
      try {
        const nextEntryId = getSessionItem('be.myEntryId');
        const nextSection = getSessionItem('be.mySection');
        const nextRole = getSessionItem('be.myRole');

        startTransition(() => {
          setMyEntryId(nextEntryId);
          setMySection(nextSection);
          setMyRole(nextRole);
        });
      } catch (err) {
        console.warn('[useIdentityState] Failed to sync identity from storage:', err);
      }
    };

    onStorageSync();

    // Keep storage listener for cross-tab sync only
    window.addEventListener('storage', onStorageSync);
    return () => { window.removeEventListener('storage', onStorageSync); };
  }, []);

  return {
    mySection,
    setMySection,
    myEntryId,
    setMyEntryId,
    myRole,
    setMyRole,
  };
}
