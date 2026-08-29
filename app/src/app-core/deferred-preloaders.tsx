// src/app-core/deferred-preloaders.tsx
// Idle-time warmup for code-split chunks that aren't needed on first paint.
import React, { Suspense, useEffect, useState } from "react";

import { scheduleIdle } from "../lib/utils/scheduleIdle";

const GamificationCopyPreloader = React.lazy(() =>
  import("../graph-runtime/gamification/GamificationCopyPreloader")
);

export function DeferredGraphPreloader() {
  useEffect(() => {
    const timer = setTimeout(() => {
      scheduleIdle(() => {
        void import('../graph-runtime/dotgraph/data-boundary');
      });
    }, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return null;
}

export function DeferredGamificationPreloader() {
  const [start, setStart] = useState<boolean>(false);

  useEffect(() => {
    const cancelIdle = scheduleIdle(() => {
      setStart(true);
    });
    return () => {
      cancelIdle?.();
    };
  }, []);

  return start ? (
    <Suspense fallback={null}>
      <GamificationCopyPreloader />
    </Suspense>
  ) : null;
}
