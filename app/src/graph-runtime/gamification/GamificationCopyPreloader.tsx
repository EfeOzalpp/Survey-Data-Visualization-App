// src/graph-runtime/gamification/GamificationCopyPreloader.tsx
import { useGeneralPools, usePersonalizedPools } from '../../client-api/read-api/gamificationCopyPools';

export default function GamificationCopyPreloader() {
  // Mounting both hooks starts one shared cached fetch for all gamification copy.
  useGeneralPools();
  usePersonalizedPools();

  // no UI
  return null;
}
