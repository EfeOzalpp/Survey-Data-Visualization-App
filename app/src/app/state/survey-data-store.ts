// src/app/state/survey-data-store.ts
import { create } from 'zustand';
import { startTransition, useEffect } from 'react';
import { getSessionItem, removeSessionItems, setSessionItem } from '../session';
import { parentAggregateForSection } from '../../domain/survey/sections';
import type { SurveyRow } from '../../domain/survey/types';
import {
  deriveSectionCounts,
  filterRowsForSection,
  removeSurveyRow,
  upsertSurveyRow,
} from './survey-data-utils';

const ALL_ROWS_LIMIT = 'all';
const FIRST_SECTION_SUBMISSION_COUNT = 1;
const noopUnsubscribe: () => void = () => undefined;
const OPTIMISTIC_MATCH_WINDOW_MS = 5 * 60 * 1000;

function closeNumber(a?: number, b?: number) {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < 0.0005;
}

function rowTimestamp(row: SurveyRow) {
  const timestamp = Date.parse(row.submittedAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function matchesOptimisticRow(remote: SurveyRow, optimistic: SurveyRow) {
  if (remote._id.startsWith('pending-')) return false;
  if (!optimistic._id.startsWith('pending-')) return false;
  if (remote.section !== optimistic.section) return false;
  if (!closeNumber(remote.q1, optimistic.q1)) return false;
  if (!closeNumber(remote.q2, optimistic.q2)) return false;
  if (!closeNumber(remote.q3, optimistic.q3)) return false;
  if (!closeNumber(remote.q4, optimistic.q4)) return false;
  if (!closeNumber(remote.q5, optimistic.q5)) return false;
  if (!closeNumber(remote.avgWeight, optimistic.avgWeight)) return false;

  const remoteTime = rowTimestamp(remote);
  const optimisticTime = rowTimestamp(optimistic);
  if (!remoteTime || !optimisticTime) return true;
  return Math.abs(remoteTime - optimisticTime) <= OPTIMISTIC_MATCH_WINDOW_MS;
}

// Local optimistic rows live outside React state, mirroring the store's
// allRows so a resubmitted/duplicate SSE snapshot can still be reconciled
// against them (see mergeLocalRows).
let localRows: SurveyRow[] = [];

function mergeLocalRows(rows: SurveyRow[]): SurveyRow[] {
  if (!localRows.length) return rows;

  const remoteIds = new Set(rows.map((row) => row._id));
  return localRows.reduce(
    (nextRows, row) => {
      if (remoteIds.has(row._id)) return nextRows;
      if (row._id.startsWith('pending-') && rows.some((remote) => matchesOptimisticRow(remote, row))) {
        return nextRows;
      }
      return upsertSurveyRow(nextRows, row);
    },
    rows
  );
}

function computeDerived(allRows: SurveyRow[], section: string) {
  return {
    counts: deriveSectionCounts(allRows),
    allFilteredRows: filterRowsForSection(allRows, section),
  };
}

function applyPostSubmitRedirect(
  nextCounts: Record<string, number>,
  mySection: string | null,
  setSection: (s: string) => void
) {
  const justSubmitted = getSessionItem('be.justSubmitted') === '1';
  if (!justSubmitted) return;

  const effectiveMySection = mySection ?? getSessionItem('be.mySection') ?? '';
  if (!effectiveMySection) return;

  if (effectiveMySection === 'visitor') {
    removeSessionItems(['be.justSubmitted']);
    return;
  }

  const sectionCount = nextCounts[effectiveMySection] ?? 0;
  const parentAggregate = parentAggregateForSection(effectiveMySection);
  if (parentAggregate && sectionCount <= FIRST_SECTION_SUBMISSION_COUNT) {
    // First entries in a specific section open the nearest useful aggregate for context.
    setSection(parentAggregate);
    setSessionItem('be.openPersonalOnNext', '1');
  }

  removeSessionItems(['be.justSubmitted']);
}

export interface SurveyDataStoreState {
  section: string;
  setSection: (s: string) => void;
  sectionSelectionVersion: number;
  counts: Record<string, number>;
  allRows: SurveyRow[];
  allFilteredRows: SurveyRow[];
  loading: boolean;
  removeLocalSurveyRow: (id: string) => void;
  upsertLocalSurveyRow: (row: SurveyRow, replaceId?: string) => void;
  subscribeToSurveyData: () => () => void;
  mySection: string | null;
}

export const useSurveyDataStore = create<SurveyDataStoreState>((set, get) => ({
  section: 'all',
  sectionSelectionVersion: 0,
  counts: {},
  allRows: [],
  allFilteredRows: [],
  loading: false,
  mySection: null,

  setSection: (nextSection) => {
    set((s) => ({
      section: nextSection,
      sectionSelectionVersion: s.sectionSelectionVersion + 1,
      ...computeDerived(s.allRows, nextSection),
    }));
  },

  upsertLocalSurveyRow: (row, replaceId) => {
    localRows = upsertSurveyRow(localRows, row, replaceId);
    set((s) => {
      const nextAllRows = upsertSurveyRow(s.allRows, row, replaceId);
      return { allRows: nextAllRows, ...computeDerived(nextAllRows, s.section) };
    });
  },

  removeLocalSurveyRow: (id) => {
    localRows = removeSurveyRow(localRows, id);
    set((s) => {
      const nextAllRows = removeSurveyRow(s.allRows, id);
      return { allRows: nextAllRows, ...computeDerived(nextAllRows, s.section) };
    });
  },

  subscribeToSurveyData: () => {
    startTransition(() => {
      set({ loading: true });
    });
    let unsub = noopUnsubscribe;
    let closed = false;

    void import('../../client-api/read-api/surveyResponseStream')
      .then(({ subscribeSurveyData }) => {
        if (closed) return;
        unsub = subscribeSurveyData({
          section: 'all',
          limit: ALL_ROWS_LIMIT,
          onData: (rows: SurveyRow[]) => {
            const nextRows = mergeLocalRows(rows);
            startTransition(() => {
              const derived = computeDerived(nextRows, get().section);
              set({ allRows: nextRows, loading: false, ...derived });
              applyPostSubmitRedirect(derived.counts, get().mySection, get().setSection);
            });
          },
        });
      })
      .catch((error: unknown) => {
        if (closed) return;
        startTransition(() => {
          set({ loading: false });
        });
        console.error('[surveyDataStore] failed to load survey data API:', error);
      });

    return () => {
      closed = true;
      unsub();
    };
  },
}));

export function useSyncMySectionForSurveyData(mySection: string | null) {
  useEffect(() => {
    useSurveyDataStore.setState({ mySection });
  }, [mySection]);
}
