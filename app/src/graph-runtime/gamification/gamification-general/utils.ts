// src/graph-runtime/gamification/gamification-general/utils.ts
// Pure band-classification logic for GamificationGeneral - no state, no API.

export function classifyGeneralBand({
  below,
  equal,
  above,
  forceSolo,
}: {
  below: number;
  equal: number;
  above: number;
  forceSolo: boolean;
}) {
  const b = Math.max(0, below | 0);
  const e = Math.max(0, equal | 0);
  const a = Math.max(0, above | 0);
  const totalOthers = b + e + a;

  const N = totalOthers + 1;
  const rankFromLow = b + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  const SMALL = N < 8;
  const BOTTOM_Q = 0.15;
  const TOP_Q = 0.85;
  const NEAR_M = 0.05;

  const isSolo = totalOthers === 0 || forceSolo;
  const isTopBand = !isSolo && a === 0;
  const isBottomBand = !isSolo && b === 0;
  const isNearTop = !isSolo && !isTopBand && (SMALL ? a === 1 : q >= TOP_Q - NEAR_M);
  const isNearBottom = !isSolo && !isBottomBand && (SMALL ? b === 1 : q <= BOTTOM_Q + NEAR_M);
  const isUpperMid = !isTopBand && !isBottomBand && !isNearTop && !isNearBottom && q > 0.60;
  const isLowerMid = !isTopBand && !isBottomBand && !isNearTop && !isNearBottom && q < 0.40;

  const band = isSolo ? 'solo'
    : isTopBand ? 'top'
    : isBottomBand ? 'bottom'
    : isNearTop ? 'nearTop'
    : isNearBottom ? 'nearBottom'
    : isUpperMid ? 'upperMid'
    : isLowerMid ? 'lowerMid'
    : 'middle';

  const tie = e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  return { band, tie, b, e, a };
}
