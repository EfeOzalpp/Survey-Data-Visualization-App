// src/graph-runtime/gamification/gamification-personal/useSoloMessageEditor.ts
// Owns the solo-message edit/save flow: local draft reducer + the actual
// write-api call. This is the api-layer + local-state.
import { useReducer } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { getSessionItem } from "../../../app-core/session";
import { useTransientFlag } from "../../../lib/hooks/useTransientFlag";
import { saveSoloMessage } from "../../../client-api/write-api/saveSoloMessage";
import type { Mode } from "../../../app-core/state/stores/ui-store";

type MessageStatus = 'idle' | 'saving' | 'saved' | 'error';

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

export function useSoloMessageEditor(
  userData: { _id?: string; soloMessage?: string } | null | undefined,
  mode: Mode
) {
  const [messageEditState, dispatchMessageEdit] = useReducer(messageEditReducer, null);
  const {
    visible: savedNoticeVisible,
    show: showSavedNotice,
    hide: hideSavedNotice,
  } = useTransientFlag(2500);

  const entryId = userData?._id ?? 'me';
  const editToken = getSessionItem('be.myEditToken');
  const messageStateKey = editToken ? `edit:${editToken}` : `entry:${entryId}`;
  const sourceSoloMessage = typeof userData?.soloMessage === 'string' ? userData.soloMessage : '';
  // dispatchMessageEdit always keys its actions by messageStateKey (never the
  // bare entryId), so that's the only key that can ever match here.
  const currentEdit = messageEditState?.entryId === messageStateKey ? messageEditState : null;
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

  const handleSoloMessageSubmit = async (event: FormEvent<HTMLFormElement>) => {
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

  const handleSoloMessageKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
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

  const handleDraftChange = (value: string) => {
    dispatchMessageEdit({ type: 'DRAFT_CHANGED', entryId: messageStateKey, value });
    hideSavedNotice();
  };

  return {
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
  };
}
