import { getSessionItem, setSessionItem } from '../../app-core/session';
import { USE_MOCK_READS } from '../read-api/config';
import {
  getClientId,
  isWriteApiEditToken,
  makeWriteApiError,
  makeRandomId,
  WriteApiError,
} from './writeApi';
import { updateMockSoloMessage } from '../mock-survey-data/mockData';

interface SavedSoloMessage {
  _id: string;
  soloMessage?: string;
}

interface WriteSoloMessagePayload {
  editToken: string;
  message: string;
  clientId: string;
  clientRequestId: string;
  website: string;
}

const MAX_MESSAGE_LENGTH = 160;

function normalizeMessage(message: string) {
  return message.trim().replace(/\s+/g, ' ').slice(0, MAX_MESSAGE_LENGTH);
}

function isSavedSoloMessage(value: unknown): value is SavedSoloMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record._id === 'string';
}

function explainSoloMessageSaveError(error: WriteApiError): Error {
  if (
    error.code === 'EDIT_TOKEN_MISMATCH' ||
    /invalid edit token|not allowed to edit/i.test(error.message)
  ) {
    return new Error(
      'This saved response cannot be edited from this browser. It may have been saved before message editing was enabled.'
    );
  }

  return error;
}

function persistSoloMessageSnapshot(updated: SavedSoloMessage) {
  const raw = getSessionItem('be.myDoc');
  if (!raw) return;

  try {
    const snapshot = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, unknown> = { ...snapshot, _id: updated._id };
    if (updated.soloMessage) {
      next.soloMessage = updated.soloMessage;
    } else {
      delete next.soloMessage;
    }
    delete next.soloMessageUpdatedAt;
    setSessionItem('be.myDoc', JSON.stringify(next));
  } catch (error) {
    console.warn('[saveSoloMessage] Failed to update local response snapshot:', error);
  }
}

export async function saveSoloMessage(message: string): Promise<SavedSoloMessage> {
  const responseId = getSessionItem('be.myEntryId');
  const editToken = getSessionItem('be.myEditToken');
  const normalized = normalizeMessage(message);

  if (!responseId || responseId.startsWith('pending-')) {
    throw new Error('Your response is still being saved. Try again in a moment.');
  }

  if (USE_MOCK_READS) {
    const updated = updateMockSoloMessage(responseId, normalized);
    persistSoloMessageSnapshot(updated);
    return updated;
  }

  if (!editToken) {
    throw new Error('This browser can no longer edit that response.');
  }

  if (!isWriteApiEditToken(editToken)) {
    throw new Error('This browser has an old edit token for that response. Submit a new response to enable message editing.');
  }

  const payload: WriteSoloMessagePayload = {
    editToken,
    message: normalized,
    clientId: getClientId(),
    clientRequestId: makeRandomId(),
    website: '',
  };

  const res = await fetch('/api/save-solo-message', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const apiError = makeWriteApiError(
      'save-solo-message',
      res.status,
      json,
      `Solo message request failed with status ${String(res.status)}`
    );
    throw explainSoloMessageSaveError(apiError);
  }

  if (!isSavedSoloMessage(json)) {
    throw new Error('Solo message API returned an invalid response');
  }

  persistSoloMessageSnapshot(json);
  return json;
}
