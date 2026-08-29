import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useSurveyDataStore } from "../../../../app-core/state/stores/survey-data-store";
import { CHOOSE_STAFF, CHOOSE_STUDENT, GO_BACK, useGraphPickerData } from "../../../graph-picker/gp-data";

interface LocalSectionState {
  sourceSection: string;
  sourceSelectionVersion: number;
  value: string;
}

const Q_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;
const AUTOPLAY_MS = 5000;
const INITIAL_PREVIEW_INDEX = 0;

interface UseByQuestionOptions {
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
}

// All state/logic behind the by-question list - section cycling/autoplay,
// per-question averages, tooltip focus. Returns a `header` bundle that maps
// directly onto WidgetsHeaderProps (spread straight onto <WidgetsHeader>)
// plus everything ByQuestionBody needs. No "ready" gate here - unlike
// BarGraph, the original component never had a no-section early return.
export function useByQuestion({ paused, onPausedChange }: UseByQuestionOptions) {
  const { allRows, section, sectionSelectionVersion } = useSurveyDataStore(
    useShallow((s) => ({ allRows: s.allRows, section: s.section, sectionSelectionVersion: s.sectionSelectionVersion }))
  );
  const { ALL_LABELS, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS, counts } = useGraphPickerData(section);
  const [internalPaused, setInternalPaused] = useState(true);
  const [tooltipIndex, setTooltipIndex] = useState<number | null>(INITIAL_PREVIEW_INDEX);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        setTooltipIndex(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => { document.removeEventListener("pointerdown", handler); };
  }, []);

  const [localSectionState, setLocalSectionState] = useState<LocalSectionState>({
    sourceSection: section,
    sourceSelectionVersion: sectionSelectionVersion,
    value: section,
  });
  const localSection =
    localSectionState.sourceSection === section &&
    localSectionState.sourceSelectionVersion === sectionSelectionVersion
      ? localSectionState.value
      : section;

  const effectivePaused = paused ?? internalPaused;

  const setEffectivePaused = useCallback((nextPaused: boolean) => {
    if (paused === undefined) setInternalPaused(nextPaused);
    onPausedChange?.(nextPaused);
  }, [onPausedChange, paused]);

  const setLocalSection = useCallback((value: string) => {
    setLocalSectionState({ sourceSection: section, sourceSelectionVersion: sectionSelectionVersion, value });
  }, [section, sectionSelectionVersion]);

  const cycleSections = useMemo(() => {
    const ordered = [...MAIN_OPTS, ...STUDENT_OPTS, ...STAFF_OPTS]
      .filter((opt) => opt.id !== GO_BACK && opt.id !== CHOOSE_STUDENT && opt.id !== CHOOSE_STAFF)
      .filter((opt, index, arr) => arr.findIndex((item) => item.id === opt.id) === index)
      .filter((opt) => (counts[opt.id] ?? 0) > 0 || opt.id === localSection);

    if (!ordered.length && localSection) {
      return [{ id: localSection, label: ALL_LABELS.get(localSection) ?? localSection }];
    }
    return ordered;
  }, [ALL_LABELS, MAIN_OPTS, STAFF_OPTS, STUDENT_OPTS, counts, localSection]);

  useEffect(() => {
    if (effectivePaused || cycleSections.length <= 1) return;
    const timer = window.setInterval(() => {
      const currentIndex = cycleSections.findIndex((item) => item.id === localSection);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cycleSections.length : 0;
      setLocalSection(cycleSections[nextIndex].id);
    }, AUTOPLAY_MS);
    return () => { window.clearInterval(timer); };
  }, [cycleSections, effectivePaused, localSection, setLocalSection]);

  const rowsForLocalSection = useMemo(() => {
    if (!localSection || localSection === "all") return allRows;
    if (localSection === "all-massart") {
      const allowed = new Set([...STUDENT_OPTS.map((opt) => opt.id), ...STAFF_OPTS.map((opt) => opt.id)]);
      return allRows.filter((row) => allowed.has(row.section));
    }
    if (localSection === "all-students") {
      const allowed = new Set(STUDENT_OPTS.map((opt) => opt.id));
      return allRows.filter((row) => allowed.has(row.section));
    }
    if (localSection === "all-staff") {
      const allowed = new Set(STAFF_OPTS.map((opt) => opt.id));
      return allRows.filter((row) => allowed.has(row.section));
    }
    return allRows.filter((row) => row.section === localSection);
  }, [STUDENT_OPTS, STAFF_OPTS, allRows, localSection]);

  const avgs = useMemo(
    () =>
      Q_KEYS.map((key) => {
        const vals = rowsForLocalSection
          .map((row) => row[key])
          .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      }),
    [rowsForLocalSection]
  );

  const currentIndex = cycleSections.findIndex((item) => item.id === localSection);
  const matchedSection = cycleSections.find((item) => item.id === localSection);
  const currentSectionLabel =
    matchedSection?.label ??
    ALL_LABELS.get(localSection) ??
    (localSection ? localSection.replace(/-/g, " ") : "Everyone");

  const stepSection = (delta: number) => {
    if (!cycleSections.length) return;
    const nextIndex = currentIndex >= 0
      ? (currentIndex + delta + cycleSections.length) % cycleSections.length
      : 0;
    setLocalSection(cycleSections[nextIndex].id);
  };

  return {
    header: {
      title: currentSectionLabel,
      paused: effectivePaused,
      onPrevious: () => { stepSection(-1); },
      onNext: () => { stepSection(1); },
      onTogglePaused: () => { setEffectivePaused(!effectivePaused); },
    },
    avgs,
    tooltipIndex,
    setTooltipIndex,
    listRef,
  };
}
