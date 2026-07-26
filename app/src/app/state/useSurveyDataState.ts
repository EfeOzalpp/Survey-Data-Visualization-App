// src/app/state/useSurveyDataState.ts
// Owns Sanity survey rows plus the active section filter used by graph views.

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getSessionItem, removeSessionItems, setSessionItem } from '../session';
import { parentAggregateForSection } from '../../domain/survey/sections';
import type { SurveyRow } from '../../domain/survey/types';
import { deriveSectionCounts, filterRowsForSection, upsertSurveyRow } from './survey-data-utils';

interface UseSurveyDataStateParams {
  mySection: string | null;
}

const ALL_ROWS_LIMIT = 'all';
const FIRST_SECTION_SUBMISSION_COUNT = 1;
const noopUnsubscribe: () => void = () => undefined;
const OPTIMISTIC_MATCH_WINDOW_MS = 5 * 60 * 1000;

function closeNumber(a?: number, b?: number) {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < 0.0005;
}

function rowTimestamp(row: SurveyRow) {
  const raw = row.submittedAt ?? row._createdAt;
  const timestamp = Date.parse(raw);
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

export default function useSurveyDataState({
  mySection,
}: UseSurveyDataStateParams) {
  const [section, setSectionValue] = useState<string>(() => mySection ?? 'all');
  const [sectionSelectionVersion, setSectionSelectionVersion] = useState(0);
  const [allRows, setAllRows] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const localRowsRef = useRef<SurveyRow[]>([]);
  const mySectionRef = useRef(mySection);

  useEffect(() => {
    mySectionRef.current = mySection;
  }, [mySection]);

  const setSection = useCallback((nextSection: string) => {
    setSectionValue(nextSection);
    setSectionSelectionVersion((version) => version + 1);
  }, []);

  const mergeLocalRows = useCallback((rows: SurveyRow[]) => {
    const localRows = localRowsRef.current;
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
  }, []);

  const applyPostSubmitRedirect = useCallback((nextCounts: Record<string, number>) => {
    const justSubmitted = getSessionItem('be.justSubmitted') === '1';
    if (!justSubmitted) return;

    const effectiveMySection = mySectionRef.current ?? getSessionItem('be.mySection') ?? '';
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
  }, [setSection]);

  const subscribeToSurveyData = useCallback(() => {
    startTransition(() => {
      setLoading(true);
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
              setAllRows(nextRows);
              setLoading(false);
              // Run redirect from fresh rows instead of waiting for a separate state effect.
              applyPostSubmitRedirect(deriveSectionCounts(nextRows));
            });
          },
        });
      })
      .catch((error: unknown) => {
        if (closed) return;
        startTransition(() => {
          setLoading(false);
        });
        console.error('[useSurveyDataState] failed to load survey data API:', error);
      });

    return () => {
      closed = true;
      unsub();
    };
  }, [applyPostSubmitRedirect, mergeLocalRows]);

  const upsertLocalSurveyRow = useCallback((row: SurveyRow, replaceId?: string) => {
    localRowsRef.current = upsertSurveyRow(localRowsRef.current, row, replaceId);
    setAllRows((rows) => upsertSurveyRow(rows, row, replaceId));
  }, []);

  const counts = useMemo(
    () => deriveSectionCounts(allRows),
    [allRows]
  );

  const filteredRows = useMemo(
    () => filterRowsForSection(allRows, section),
    [allRows, section]
  );

  return {
    section,
    setSection,
    sectionSelectionVersion,
    counts,
    allRows,
    allFilteredRows: filteredRows,
    loading,
    upsertLocalSurveyRow,
    subscribeToSurveyData,
  };
}
