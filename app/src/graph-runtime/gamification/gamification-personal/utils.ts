// src/graph-runtime/gamification/gamification-personal/utils.ts
// Pure helpers for GamificationPersonalized - no state, no API, no context.
import type { SyntheticEvent } from 'react';

export function ordinalSuffix(n: number): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${String(n)}th`;
  switch (Math.abs(n) % 10) {
    case 1: return `${String(n)}st`;
    case 2: return `${String(n)}nd`;
    case 3: return `${String(n)}rd`;
    default: return `${String(n)}th`;
  }
}

// Stops both React's synthetic propagation and the raw native DOM propagation.
// Needed because the dot graph's camera controls (useZoom.ts, useRotation.ts)
// attach their pan/zoom/rotate handlers directly via window.addEventListener,
// bypassing React's synthetic event system entirely - React's own
// stopPropagation() alone would not stop those.
export function stopGraphEventPropagation(event: SyntheticEvent<HTMLElement>) {
  event.stopPropagation();
  event.nativeEvent.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

export function classifyBand({ below: b, equal: e, above: a }: { below: number; equal: number; above: number }) {
  const totalOthers = Math.max(0, b | 0) + Math.max(0, e | 0) + Math.max(0, a | 0);
  const N = totalOthers + 1;
  const rankFromLow = (b | 0) + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  const isSolo = totalOthers === 0;
  if (isSolo) return { band: 'solo', tie: 'none', b, e, a };

  const isTopBand = a === 0;
  const isBottomBand = b === 0;

  const EDGE_COUNT = Math.max(2, Math.ceil(0.25 * N));
  const NEAR_Q = 0.30;

  const nearBottom = !isBottomBand && (rankFromLow <= EDGE_COUNT || q <= NEAR_Q);
  const nearTop    = !isTopBand    && ((N - rankFromLow + 1) <= EDGE_COUNT || q >= (1 - NEAR_Q));

  let band = 'middle';
  if (isTopBand) band = 'top';
  else if (isBottomBand) band = 'bottom';
  else if (nearTop) band = 'nearTop';
  else if (nearBottom) band = 'nearBottom';

  const canonicalTie =
    e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  return { band, tie: canonicalTie, b, e, a };
}
