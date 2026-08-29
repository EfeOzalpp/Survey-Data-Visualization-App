// src/graph-runtime/gamification/gamification-personal/index.tsx
import React from 'react';
import CloseIcon from '../../../assets/svg/close/CloseIcon';
import PlusIcon from '../../../assets/svg/plus/PlusIcon';

import "../../../styles/gamification.css";

import type { Mode } from "../../../app-core/state/stores/ui-store";
import HintBanner from "../../../app-core/ui-generics/HintBanner";
import { recordOwnRender } from "../../../render-test/renderProfilerStats";

import { ordinalSuffix, stopGraphEventPropagation, classifyBand } from './utils';
import { useSoloMessageEditor } from './useSoloMessageEditor';
import { usePersonalizedPanelUi } from './usePersonalizedPanelUi';
import SoloMessageForm from './SoloMessageForm';

const FADE_MS = 200;

interface InlineLinesProps {
  children: React.ReactNode;
}

interface HighlightWordProps extends InlineLinesProps {
  color: string;
}

function InlineLines({ children }: InlineLinesProps) {
  return <span className="gam-inline-lines">{children}</span>;
}

function HighlightWord({ children, color }: HighlightWordProps) {
  return <strong style={{ textShadow: `0 0 7px ${color}` }}>{children}</strong>;
}

interface GamificationPersonalizedProps {
  userData: { _id?: string; soloMessage?: string } | null | undefined;
  percentage: number | undefined;
  score?: number;
  groupAverage?: number;
  color: string;
  shapeCopy?: string;
  mode?: Mode;
  onOpenChange?: (open: boolean) => void;
  onPanelEnter?: () => void;
  belowCountStrict?: number;
  equalCount?: number;
  aboveCountStrict?: number;
  statsLoading?: boolean;
  zoomFraction?: number;
}

export default function GamificationPersonalized({
  userData,
  percentage,
  score,
  groupAverage,
  color,
  shapeCopy,
  mode = 'relative',
  onOpenChange,
  onPanelEnter,

  belowCountStrict,
  equalCount,
  aboveCountStrict,
  statsLoading = false,
  zoomFraction,
}: GamificationPersonalizedProps) {
  recordOwnRender("GamificationPersonalized");

  const { open, setOpen } = usePersonalizedPanelUi(onOpenChange);
  const {
    messageDraft,
    normalizedSavedMessage,
    currentMessageStatus,
    messageError,
    saveMessageDisabled,
    savedNoticeVisible,
    hideSavedNotice,
    handleSoloMessageSubmit,
    handleSoloMessageKeyDown,
    handleDraftChange,
  } = useSoloMessageEditor(userData, mode);

  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const safeGroupAverage = Math.max(0, Math.min(100, Math.round(Number(groupAverage) || 0)));

  if (!userData) return null;

  const panelId = `panel-${userData._id ?? 'me'}`;
  const wrapperVisible = open || (zoomFraction !== undefined ? zoomFraction > 0.7 : true);

  // bands (rank + ties)
  const b = Math.max(0, (belowCountStrict ?? 0) | 0);
  const e = Math.max(0, (equalCount ?? 0) | 0);
  const a = Math.max(0, (aboveCountStrict ?? 0) | 0);

  const bandInfo = classifyBand({ below: b, equal: e, above: a });

  // --- Personalized relative line (highlight only Top / Middle / Bottom words; numbers stay neutral) ---
  let relativeLine = null;
  if (mode === 'relative' && statsLoading) {
    relativeLine = <span className="stats-loading-word" role="status">Loading...</span>;
  } else if (mode === 'relative') {
    const { band, tie, b: bb, e: ee, a: aa } = bandInfo;

    switch (band) {
      case 'solo':
        relativeLine = <>You're the first one here.</>;
        break;
      case 'top':
        relativeLine = tie === 'tiedTop'
          ? <InlineLines><span>Sharing the very <HighlightWord color={color}>top</HighlightWord>.</span><span>Tied with {ee}.</span></InlineLines>
          : <InlineLines><span>You're on <HighlightWord color={color}>top</HighlightWord>,</span><span>ahead of everyone else.</span></InlineLines>;
        break;
      case 'nearTop':
        relativeLine = ee > 0
          ? <InlineLines><span>Close to the <HighlightWord color={color}>top</HighlightWord>.</span><span>Behind {aa}</span><span>Tied with {ee}.</span></InlineLines>
          : <InlineLines><span>Close to the <HighlightWord color={color}>top</HighlightWord>.</span><span>Behind {aa}</span></InlineLines>;
        break;
      case 'bottom':
        relativeLine = tie === 'tiedBottom'
          ? <InlineLines><span>At the <HighlightWord color={color}>bottom</HighlightWord>.</span><span>Tied with {ee}.</span></InlineLines>
          : <InlineLines><span>At the <HighlightWord color={color}>bottom</HighlightWord>.</span><span>Everyone else is ahead.</span></InlineLines>;
        break;
      case 'nearBottom':
        relativeLine = ee > 0
          ? <InlineLines><span>Near the <HighlightWord color={color}>bottom</HighlightWord>.</span><span>Ahead of {bb}</span><span>Tied with {ee}.</span></InlineLines>
          : <InlineLines><span>Near the <HighlightWord color={color}>bottom</HighlightWord>.</span><span>Ahead of {bb}</span></InlineLines>;
        break;
      default: {
        // middle
        if (tie === 'tiedMiddle') {
          relativeLine = <InlineLines><span>In the <HighlightWord color={color}>middle</HighlightWord>.</span><span>Ahead of {bb}</span><span>Behind {aa}</span><span>Tied with {ee}.</span></InlineLines>;
        } else if (aa < bb) {
          relativeLine = <InlineLines><span>In the <HighlightWord color={color}>middle</HighlightWord>.</span><span>Behind {aa}</span></InlineLines>;
        } else if (bb < aa) {
          relativeLine = <InlineLines><span>In the <HighlightWord color={color}>middle</HighlightWord>.</span><span>Ahead of {bb}</span></InlineLines>;
        } else {
          relativeLine = <InlineLines><span>In the <HighlightWord color={color}>middle</HighlightWord>.</span><span>Ahead of {bb}</span><span>Behind {aa}</span></InlineLines>;
        }
      }
    }
  }

  const saveLabel = currentMessageStatus === 'saving' ? 'Saving' : 'Save';
  const isTopPercentile = safePct >= 50;
  const percentileValue = Math.max(1, isTopPercentile ? 100 - safePct : safePct);

  return (
    <div
      className={`personalized-root ${wrapperVisible ? 'is-visible' : ''}`}
      onPointerEnter={onPanelEnter}
      onTouchStart={onPanelEnter}
      onPointerDownCapture={stopGraphEventPropagation}
      onTouchStartCapture={stopGraphEventPropagation}
      onWheelCapture={stopGraphEventPropagation}
    >
      <div className="personalized-anchor">
      {!open && (
        <button
          type="button"
          className="toggle-button toggle"
          aria-controls={panelId}
          aria-expanded={false}
          aria-label="Open personalized panel"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          style={{ pointerEvents: 'auto' }}
        >
          <span className="toggle-icon is-closed svg-sm" aria-hidden>
            <PlusIcon className="icon-plus ui-icon" />
          </span>
        </button>
      )}

      {open && (
        <div
          id={panelId}
          className="personalized-result"
          style={{ pointerEvents: 'auto', transition: `opacity ${String(FADE_MS)}ms ease` }}
        >
          <button
            type="button"
            className="personal-close-btn"
            aria-label="Close personalized panel"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          >
            <CloseIcon className="ui-close svg-sm" />
          </button>
          <div className={`gam-panel${mode === 'relative' ? ' is-team' : ''}`}>
            {mode === 'relative' ? (
              <>
                <p className="gam-copy">{relativeLine}</p>
                <p className="gam-team-story">
                  Your score is <strong>{safeScore}%</strong>. The group averages{' '}
                  <strong>{safeGroupAverage}%</strong>. This makes you{' '}
                  <strong>{isTopPercentile ? 'top' : 'bottom'} {ordinalSuffix(percentileValue)} percentile</strong>.
                </p>
              </>
            ) : (
              <>
                <p className="solo-map-note">Your shape is added amongst others</p>
                {shapeCopy ? (
                  <h4 className="gam-subline">{shapeCopy}</h4>
                ) : normalizedSavedMessage ? (
                  <h4 className="gam-subline">{normalizedSavedMessage}</h4>
                ) : null}
                <div className="solo-message-intro">
                  <h4>Have a word to say?</h4>
                  <p>It stays here, with your shape.</p>
                </div>
                <SoloMessageForm
                  panelId={panelId}
                  messageDraft={messageDraft}
                  isSaving={currentMessageStatus === 'saving'}
                  saveMessageDisabled={saveMessageDisabled}
                  messageError={messageError}
                  saveLabel={saveLabel}
                  onSubmit={(event) => { void handleSoloMessageSubmit(event); }}
                  onKeyDown={handleSoloMessageKeyDown}
                  onDraftChange={handleDraftChange}
                />
              </>
            )}
          </div>
          <HintBanner
            visible={savedNoticeVisible}
            className="solo-message-save-toast"
            closeLabel="Dismiss save confirmation"
            onDismiss={hideSavedNotice}
          >
            Message saved.
          </HintBanner>
        </div>
      )}
      </div>
    </div>
  );
}
