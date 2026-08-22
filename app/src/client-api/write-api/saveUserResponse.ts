import { USE_MOCK_READS } from '../read-api/config';
import { createMockUserResponse } from '../mock-survey-data/mockData';
import type { SurveyRow, SurveyWeights } from '../../domain/survey/types';
import { setSessionItem } from '../../app/session';
import {
  getClientId,
  makeRandomId,
  makeWriteApiError,
} from './writeApi';

interface SavedUserResponse {
  _id: string;
  section?: string;
  q1?: number;
  q2?: number;
  q3?: number;
  q4?: number;
  q5?: number;
  avgWeight?: number;
  soloMessage?: string;
  submittedAt?: string;
  editToken?: string;
}

interface WriteSavePayload {
  section: string;
  weights: SurveyWeights;
  clientId: string;
  clientRequestId: string;
  website: string;
}

const clamp01 = (v?: number) =>
  typeof v === 'number' ? Math.max(0, Math.min(1, v)) : undefined;

const round3 = (v?: number) =>
  typeof v === 'number' ? Math.round(v * 1000) / 1000 : undefined;

const computeAvg = (weights: SurveyWeights) => {
  const vals = [weights.q1, weights.q2, weights.q3, weights.q4, weights.q5].filter(
    (x): x is number => Number.isFinite(x)
  );
  if (!vals.length) return undefined;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
};

function normalizeWeights(weights: SurveyWeights): SurveyWeights {
  return {
    q1: round3(clamp01(weights.q1)),
    q2: round3(clamp01(weights.q2)),
    q3: round3(clamp01(weights.q3)),
    q4: round3(clamp01(weights.q4)),
    q5: round3(clamp01(weights.q5)),
  };
}

function isSavedUserResponse(value: unknown): value is SavedUserResponse {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record._id === 'string';
}

export function createOptimisticUserResponse(section: string, weights: SurveyWeights): SavedUserResponse {
  const clamped = normalizeWeights(weights);
  const submittedAt = new Date().toISOString();
  const avgWeight = round3(computeAvg(clamped)) ?? 0.5;

  return {
    _id: `pending-${makeRandomId()}`,
    section,
    q1: clamped.q1 ?? 0.5,
    q2: clamped.q2 ?? 0.5,
    q3: clamped.q3 ?? 0.5,
    q4: clamped.q4 ?? 0.5,
    q5: clamped.q5 ?? 0.5,
    avgWeight,
    submittedAt,
  };
}

export function savedUserResponseToSurveyRow(
  response: SavedUserResponse,
  fallbackSection: string
): SurveyRow {
  const submittedAt = response.submittedAt ?? new Date().toISOString();
  const q1 = response.q1 ?? 0.5;
  const q2 = response.q2 ?? 0.5;
  const q3 = response.q3 ?? 0.5;
  const q4 = response.q4 ?? 0.5;
  const q5 = response.q5 ?? 0.5;

  return {
    _id: response._id,
    section: response.section ?? fallbackSection,
    q1,
    q2,
    q3,
    q4,
    q5,
    avgWeight: response.avgWeight,
    soloMessage: response.soloMessage,
    submittedAt: response.submittedAt ?? submittedAt,
  };
}

export function persistUserResponseSession(created: SavedUserResponse, section: string) {
  if (typeof window === 'undefined') return;

  try {
    setSessionItem('be.myEntryId', created._id);
    setSessionItem('be.mySection', section);
    setSessionItem('be.justSubmitted', '1');
    if (created.editToken) setSessionItem('be.myEditToken', created.editToken);
  } catch (err) {
    console.warn('[saveUserResponse] Failed to persist identity to browser storage:', err);
  }

  try {
    const snapshot = {
      _id: created._id,
      section,
      q1: created.q1,
      q2: created.q2,
      q3: created.q3,
      q4: created.q4,
      q5: created.q5,
      avgWeight: created.avgWeight,
      soloMessage: created.soloMessage,
      submittedAt: created.submittedAt,
    };
    setSessionItem('be.myDoc', JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[saveUserResponse] Failed to persist snapshot to browser storage:', err);
  }
}

export async function saveUserResponse(section: string, weights: SurveyWeights): Promise<SavedUserResponse> {
  const clamped = normalizeWeights(weights);

  let created: SavedUserResponse;
  if (USE_MOCK_READS) {
    created = createMockUserResponse(section, clamped);
  } else {
    created = await saveUserResponseViaApi(section, clamped);
  }

  persistUserResponseSession(created, section);

  return created;
}

async function saveUserResponseViaApi(section: string, weights: SurveyWeights): Promise<SavedUserResponse> {
  const basePayload = {
    section,
    weights,
    clientId: getClientId(),
    // Quiet bot trap. The UI never fills this, so the server can reject it if it appears.
    website: '',
  };

  const payload: WriteSavePayload = {
    ...basePayload,
    clientRequestId: makeRandomId(),
  };

  return await postSaveUserResponse(payload);
}

async function postSaveUserResponse(payload: WriteSavePayload): Promise<SavedUserResponse> {
  const res = await fetch('/api/save-user-response', {
    method: 'POST',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw makeWriteApiError(
      'save-user-response',
      res.status,
      json,
      `Write API request failed with status ${String(res.status)}`
    );
  }

  if (!isSavedUserResponse(json)) {
    throw new Error('Write API returned an invalid response');
  }

  return json;
}
