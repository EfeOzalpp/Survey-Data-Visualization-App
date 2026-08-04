// src/graph-runtime/gamification/gamification-personal.tsx

import React, { useEffect, useReducer, useState } from 'react';
import CloseIcon from '../../assets/svg/close/CloseIcon';

import "../../styles/gamification.css";

import { getSessionItem } from "../../app/session";
import { useOptionalPreferences } from "../../app/state/preferences-context";
import { useUiStore } from "../../app/state/ui-store";
import HintBanner from "../../app/ui/HintBanner";
import { useTransientFlag } from "../../lib/hooks/useTransientFlag";
import { saveSoloMessage } from "../../client-api/response-api/saveSoloMessage";
import { recordOwnRender } from "../../render-test/renderProfilerStats";

const FADE_MS = 200;
type MessageStatus = 'idle' | 'saving' | 'saved' | 'error';

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

function ordinalSuffix(n: number): string {
  const mod100 = Math.abs(n) % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${String(n)}th`;
  switch (Math.abs(n) % 10) {
    case 1: return `${String(n)}st`;
    case 2: return `${String(n)}nd`;
    case 3: return `${String(n)}rd`;
    default: return `${String(n)}th`;
  }
}

function stopGraphEventPropagation(event: React.SyntheticEvent<HTMLElement>) {
  event.stopPropagation();
  event.nativeEvent.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

// Consolidates what used to be three separate `{ entryId, ... }`-keyed useState
// slots (savedMessageOverride, draftState, messageStatus) into one state shape,
// so "does this belong to the currently displayed entry" is checked once at
// the read site instead of three times, and a save always updates every
// related field together instead of relying on three separate setters agreeing.
interface MessageEditState {
  entryId: string;
  draftValue: string;
  dirty: boolean;
  savedOverride: string | null;
  status: MessageStatus;
  error: string;
}

type MessageEditAction =
  | { type: 'DRAFT_CHANGED'; entryId: string; value: string }
  | { type: 'SAVE_START'; entryId: string }
  | { type: 'SAVE_SUCCEEDED'; entryId: string; value: string }
  | { type: 'SAVE_FAILED'; entryId: string; error: string };

function messageEditReducer(state: MessageEditState | null, action: MessageEditAction): MessageEditState | null {
  const current = state?.entryId === action.entryId ? state : null;

  switch (action.type) {
    case 'DRAFT_CHANGED':
      return {
        entryId: action.entryId,
        draftValue: action.value,
        dirty: true,
        savedOverride: current?.savedOverride ?? null,
        status: 'idle',
        error: '',
      };
    case 'SAVE_START':
      return {
        entryId: action.entryId,
        draftValue: current?.draftValue ?? '',
        dirty: current?.dirty ?? false,
        savedOverride: current?.savedOverride ?? null,
        status: 'saving',
        error: '',
      };
    case 'SAVE_SUCCEEDED':
      return {
        entryId: action.entryId,
        draftValue: action.value,
        dirty: false,
        savedOverride: action.value,
        status: 'saved',
        error: '',
      };
    case 'SAVE_FAILED':
      return {
        entryId: action.entryId,
        draftValue: current?.draftValue ?? '',
        dirty: current?.dirty ?? false,
        savedOverride: current?.savedOverride ?? null,
        status: 'error',
        error: action.error,
      };
    default:
      return state;
  }
}

function classifyBand({ below: b, equal: e, above: a }: { below: number; equal: number; above: number }) {
  const totalOthers = Math.max(0, b | 0) + Math.max(0, e | 0) + Math.max(0, a | 0);
  const N = totalOthers + 1;
  const rankFromLow = (b | 0) + 1;
  const q = N > 0 ? rankFromLow / N : 0;

  const isSolo = totalOthers === 0;
  if (isSolo) return { band: 'solo', tie: 'none', N, b, e, a, q, rankFromLow };

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

  return { band, tie: canonicalTie, N, b, e, a, q, rankFromLow };
}

interface GamificationPersonalizedProps {
  userData: { _id?: string; soloMessage?: string } | null | undefined;
  percentage: number | undefined;
  score?: number;
  groupAverage?: number;
  color: string;
  shapeCopy?: string;
  mode?: 'relative' | 'absolute';
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
  const darkMode = !!useOptionalPreferences()?.darkMode;
  const openPersonalized = useUiStore((s) => s.openPersonalized);
  const setOpenPersonalized = useUiStore((s) => s.setOpenPersonalized);

  // Title stays in the CMS contract, but this panel only renders the secondary line.
  const [open, setOpen] = useState(true);
  const [messageEditState, dispatchMessageEdit] = useReducer(messageEditReducer, null);
  const {
    visible: savedNoticeVisible,
    show: showSavedNotice,
    hide: hideSavedNotice,
  } = useTransientFlag(2500);


  const safePct = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
  const safeScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const safeGroupAverage = Math.max(0, Math.min(100, Math.round(Number(groupAverage) || 0)));
  const entryId = userData?._id ?? 'me';
  const editToken = getSessionItem('be.myEditToken');
  const messageStateKey = editToken ? `edit:${editToken}` : `entry:${entryId}`;
  const sourceSoloMessage = typeof userData?.soloMessage === 'string' ? userData.soloMessage : '';
  const currentEdit =
    messageEditState?.entryId === messageStateKey || messageEditState?.entryId === entryId
      ? messageEditState
      : null;
  const savedSoloMessage = currentEdit?.savedOverride ?? sourceSoloMessage;
  const messageDraft = currentEdit?.dirty ? currentEdit.draftValue : savedSoloMessage;
  const currentMessageStatus = currentEdit?.status ?? 'idle';
  const messageError = currentEdit?.error ?? '';
  const normalizedDraft = messageDraft.trim().replace(/\s+/g, ' ');
  const normalizedSavedMessage = savedSoloMessage.trim().replace(/\s+/g, ' ');
  const canSaveSoloMessage = Boolean(
    mode === 'absolute' &&
    userData?._id &&
    !userData._id.startsWith('pending-')
  );
  const saveMessageDisabled =
    currentMessageStatus === 'saving' ||
    !canSaveSoloMessage ||
    normalizedDraft === normalizedSavedMessage;

  const handleSoloMessageSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (saveMessageDisabled) return;

    dispatchMessageEdit({ type: 'SAVE_START', entryId: messageStateKey });
    try {
      const updated = await saveSoloMessage(messageDraft);
      const next = updated.soloMessage ?? '';
      dispatchMessageEdit({ type: 'SAVE_SUCCEEDED', entryId: messageStateKey, value: next });
      showSavedNotice();
    } catch (error) {
      console.error('[GamificationPersonalized] save solo message failed:', error);
      dispatchMessageEdit({
        type: 'SAVE_FAILED',
        entryId: messageStateKey,
        error: error instanceof Error ? error.message : 'Message could not be saved.',
      });
    }
  };

  const handleSoloMessageKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.form?.requestSubmit();
  };

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
          className={`toggle-button toggle${darkMode ? ' is-dark' : ''}`}
          aria-controls={panelId}
          aria-expanded={false}
          aria-label="Open personalized panel"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          style={{ pointerEvents: 'auto' }}
        >
          <span className="toggle-icon is-closed" aria-hidden>
            <svg className="icon-plus ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <line x1="12" y1="5"  x2="12" y2="19" strokeWidth="2.5" />
              <line x1="5"  y1="12" x2="19" y2="12" strokeWidth="2.5" />
            </svg>
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
            <CloseIcon className="ui-close" />
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
            ) : null}
            {mode === 'absolute' ? (
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
              </>
            ) : null}
            {mode === 'absolute' ? (
              <form className="solo-message-form" onSubmit={(event) => { void handleSoloMessageSubmit(event); }}>
                <textarea
                  id={`${panelId}-message`}
                  className="solo-message-input"
                  aria-label="Personal message"
                  value={messageDraft}
                  maxLength={160}
                  rows={2}
                  placeholder="I've been thinking about..."
                  disabled={currentMessageStatus === 'saving'}
                  onClick={(event) => { event.stopPropagation(); }}
                  onKeyDown={handleSoloMessageKeyDown}
                  onChange={(event) => {
                    dispatchMessageEdit({ type: 'DRAFT_CHANGED', entryId: messageStateKey, value: event.currentTarget.value });
                    hideSavedNotice();
                  }}
                />
                <div className="solo-message-actions">
                  <span className="solo-message-count">{160 - messageDraft.length}</span>
                  <button
                    type="submit"
                    className="solo-message-save"
                    disabled={saveMessageDisabled}
                  >
                    <span className="solo-message-save__ghost" aria-hidden="true">Saving</span>
                    <span className="solo-message-save__inner">{saveLabel}</span>
                  </button>
                </div>
                {messageError ? <p className="solo-message-state is-error" role="alert">{messageError}</p> : null}
              </form>
            ) : null}
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
