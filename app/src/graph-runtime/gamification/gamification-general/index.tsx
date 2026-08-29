// src/graph-runtime/gamification/gamification-general/index.tsx
import React from 'react';

import '../../../styles/gamification.css';

import type { Mode } from "../../../app-core/state/stores/ui-store";

import { classifyGeneralBand } from './utils';
import { useEmphasisShadow } from './useEmphasisShadow';
import { useGeneralCopy } from './useGeneralCopy';

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
  const emphasisShadow = useEmphasisShadow(color);

  const safePct = Math.max(0, Math.min(100, Number.isFinite(percentage) ? Math.round(percentage) : 0));
  const normalizedSoloMessage = typeof soloMessage === 'string'
    ? soloMessage.trim().replace(/\s+/g, ' ')
    : '';

  const description = useGeneralCopy(dotId, safePct);

  const { band, tie, b, e, a } = classifyGeneralBand({
    below: belowCountStrict ?? 0,
    equal: equalCount ?? 0,
    above: aboveCountStrict ?? 0,
    forceSolo: positionClass === 'solo',
  });

  if (!dotId) return null;

  // --- RELATIVE MODE (highlight only Top / Middle / Bottom words; numbers stay neutral) ---
  let relativeLine = null;

  if (mode === 'relative') {
    switch (band) {
      case 'solo':
        relativeLine = <>First one here.</>;
        break;
      case 'top':
        relativeLine = tie === 'tiedTop'
          ? <InlineLines><span><Emphasis textShadow={emphasisShadow}>top</Emphasis> spot.</span><span>Tied with {e}</span></InlineLines>
          : <><Emphasis textShadow={emphasisShadow}>top</Emphasis> of the group</>;
        break;
      case 'nearTop':
        relativeLine = e > 0
          ? <InlineLines><span>Near <Emphasis textShadow={emphasisShadow}>top</Emphasis>.</span><span>Behind {a}</span><span>Tied with {e}</span></InlineLines>
          : <InlineLines><span>Near <Emphasis textShadow={emphasisShadow}>top</Emphasis>.</span><span>Behind {a}</span></InlineLines>;
        break;
      case 'bottom':
        relativeLine = tie === 'tiedBottom'
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
        if (tie === 'tiedMiddle') {
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
