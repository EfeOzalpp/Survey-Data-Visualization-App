// src/graph-runtime/gamification/gamification-general.tsx

import React, { useMemo } from 'react';

import '../../styles/gamification.css';

import { useGeneralPools } from "../../lib/hooks/useGamificationPools";
import { useOptionalPreferences } from "../../app-core/state/preferences-context";
import type { Mode } from "../../app-core/state/ui-store";

interface GamificationGeneralProps {
  dotId: string;
  percentage: number;
  color: string;
  soloMessage?: string;
  mode?: Mode;
  belowCountStrict?: number;
  equalCount?: number;
  aboveCountStrict?: number;
  positionClass?: string;
}

interface InlineTextProps {
  children: React.ReactNode;
}

interface EmphasisProps extends InlineTextProps {
  textShadow: string;
}

function InlineLines({ children }: InlineTextProps) {
  return <span className="gam-inline-lines">{children}</span>;
}

function Emphasis({ children, textShadow }: EmphasisProps) {
  return <strong style={{ textShadow }}>{children}</strong>;
}

export default function GamificationGeneral({
  dotId,
  percentage,
  color,
  soloMessage,
  mode = 'relative',
  belowCountStrict,
  equalCount,
  aboveCountStrict,
  positionClass,
}: GamificationGeneralProps) {
  const preferences = useOptionalPreferences();
  const darkMode = preferences?.darkMode ?? false;
  
  const safePct = Math.max(0, Math.min(100, Number.isFinite(percentage) ? Math.round(percentage) : 0));
  const normalizedSoloMessage = typeof soloMessage === 'string'
    ? soloMessage.trim().replace(/\s+/g, ' ')
    : '';
  const emphasisShadow = useMemo(
    () =>
      darkMode
        ? `0 0 10px color-mix(in srgb, ${color} 52%, var(--gam-glow-dark-base)), 0 0 18px color-mix(in srgb, ${color} 32%, var(--gam-glow-dark-base))`
        : `0 0 8px color-mix(in srgb, ${color} 30%, var(--gam-glow-light-base)), 0 0 14px color-mix(in srgb, ${color} 16%, var(--gam-glow-light-base))`,
    [color, darkMode]
  );
    
  const { pick, loaded } = useGeneralPools();

  // counts
  const b = Math.max(0, (belowCountStrict ?? 0) | 0);
  const e = Math.max(0, (equalCount ?? 0) | 0);
  const a = Math.max(0, (aboveCountStrict ?? 0) | 0);
  const totalOthers = b + e + a;

  // rank + percentile
  const N = totalOthers + 1;
  const rankFromLow = b + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  // heuristics
  const SMALL = N < 8;
  const BOTTOM_Q = 0.15;
  const TOP_Q = 0.85;
  const NEAR_M = 0.05;

  // bands
  const isSolo = totalOthers === 0 || positionClass === 'solo';
  const isTopBand = !isSolo && a === 0;
  const isBottomBand = !isSolo && b === 0;
  const isNearTop = !isSolo && !isTopBand && (SMALL ? a === 1 : q >= TOP_Q - NEAR_M);
  const isNearBottom = !isSolo && !isBottomBand && (SMALL ? b === 1 : q <= BOTTOM_Q + NEAR_M);
  // middle thirds
  const isUpperMid = !isTopBand && !isBottomBand && !isNearTop && !isNearBottom && q > 0.60;
  const isLowerMid = !isTopBand && !isBottomBand && !isNearTop && !isNearBottom && q < 0.40;

  // canonical tie state (derived)
  const canonicalTie =
    e > 0 ? (isTopBand ? 'tiedTop' : isBottomBand ? 'tiedBottom' : 'tiedMiddle') : 'notTied';

  const { description } = useMemo(() => {
    const fallbackBuckets = {
      '0-20': {
        titles: ['The warmest years in history? Almost all in the past decade.'],
        secondary: ['Hope grows when we do.'],
      },
      '21-40': {
        titles: ['Below Average', 'Getting Started'],
        secondary: ['Most carbon still comes from how we move and what we power.'],
      },
      '41-60': {
        titles: ['Reuse is just creativity in disguise.'],
        secondary: ['Little acts, lasting impact.'],
      },
      '61-80': {
        titles: ['Above Average', 'Solid Standing'],
        secondary: ['Cool the planet, warm the heart.'],
      },
      '81-100': {
        titles: ['No one\'s too small to make an impact.'],
        secondary: ['Among the strongest here.'],
      },
    };

    if (!loaded || !dotId) return { title: '', description: '' };
    const chosen = pick(safePct, 'gd', dotId, fallbackBuckets);

    return chosen
      ? { title: chosen.title, description: chosen.secondary || '' }
      : { title: 'Eco Participant', description: '' };
  }, [dotId, safePct, pick, loaded]);

  if (!dotId) return null;

  // --- RELATIVE MODE (highlight only Top / Middle / Bottom words; numbers stay neutral) ---
  let relativeLine = null;

  if (mode === 'relative') {
    const band = isSolo ? 'solo' : isTopBand ? 'top' : isBottomBand ? 'bottom' : isNearTop ? 'nearTop' : isNearBottom ? 'nearBottom' : isUpperMid ? 'upperMid' : isLowerMid ? 'lowerMid' : 'middle';

    switch (band) {
      case 'solo':
        relativeLine = <>First one here.</>;
        break;
      case 'top':
        relativeLine = canonicalTie === 'tiedTop'
          ? <InlineLines><span><Emphasis textShadow={emphasisShadow}>top</Emphasis> spot.</span><span>Tied with {e}</span></InlineLines>
          : <><Emphasis textShadow={emphasisShadow}>top</Emphasis> of the group</>;
        break;
      case 'nearTop':
        relativeLine = e > 0
          ? <InlineLines><span>Near <Emphasis textShadow={emphasisShadow}>top</Emphasis>.</span><span>Behind {a}</span><span>Tied with {e}</span></InlineLines>
          : <InlineLines><span>Near <Emphasis textShadow={emphasisShadow}>top</Emphasis>.</span><span>Behind {a}</span></InlineLines>;
        break;
      case 'bottom':
        relativeLine = canonicalTie === 'tiedBottom'
          ? <InlineLines><span><Emphasis textShadow={emphasisShadow}>bottom</Emphasis>.</span><span>Tied with {e}</span></InlineLines>
          : <><Emphasis textShadow={emphasisShadow}>bottom</Emphasis></>;
        break;
      case 'nearBottom':
        relativeLine = e > 0
          ? <InlineLines><span>Near <Emphasis textShadow={emphasisShadow}>bottom</Emphasis>.</span><span>Ahead of {b}</span><span>Tied with {e}</span></InlineLines>
          : <InlineLines><span>Near <Emphasis textShadow={emphasisShadow}>bottom</Emphasis>.</span><span>Ahead of {b}</span></InlineLines>;
        break;
      case 'upperMid':
        relativeLine = e > 0
          ? <InlineLines><span><Emphasis textShadow={emphasisShadow}>upper half</Emphasis>.</span><span>Ahead of {b}</span><span>Behind {a}</span><span>Tied with {e}</span></InlineLines>
          : <InlineLines><span><Emphasis textShadow={emphasisShadow}>upper half</Emphasis>.</span><span>Ahead of {b}</span><span>Behind {a}</span></InlineLines>;
        break;
      case 'lowerMid':
        relativeLine = e > 0
          ? <InlineLines><span><Emphasis textShadow={emphasisShadow}>lower half</Emphasis>.</span><span>Ahead of {b}</span><span>Behind {a}</span><span>Tied with {e}</span></InlineLines>
          : <InlineLines><span><Emphasis textShadow={emphasisShadow}>lower half</Emphasis>.</span><span>Ahead of {b}</span><span>Behind {a}</span></InlineLines>;
        break;
      default: {
        // middle
        if (canonicalTie === 'tiedMiddle') {
          relativeLine = <InlineLines><span><Emphasis textShadow={emphasisShadow}>middle</Emphasis>.</span><span>Ahead of {b}</span><span>Behind {a}</span><span>Tied with {e}</span></InlineLines>;
        } else if (a < b) {
          relativeLine = <InlineLines><span><Emphasis textShadow={emphasisShadow}>middle</Emphasis>.</span><span>Behind {a}</span></InlineLines>;
        } else if (b < a) {
          relativeLine = <InlineLines><span><Emphasis textShadow={emphasisShadow}>middle</Emphasis>.</span><span>Ahead of {b}</span></InlineLines>;
        } else {
          relativeLine = <InlineLines><span><Emphasis textShadow={emphasisShadow}>middle</Emphasis>.</span><span>Ahead of {b}</span><span>Behind {a}</span></InlineLines>;
        }
      }
    }
  }

  return (
    <div className="generalized-result">
      <div className={`gam-panel${mode === 'relative' ? ' is-team' : ''}`}>
        {/* no title in either mode */}
        {mode === 'absolute' && (normalizedSoloMessage || description) ? (
          <h4 className="gam-subline">{normalizedSoloMessage || description}</h4>
        ) : null}
        {mode === 'relative' ? (
          <p className="gam-copy">{relativeLine}</p>
        ) : null}
      </div>
    </div>
  );
}
