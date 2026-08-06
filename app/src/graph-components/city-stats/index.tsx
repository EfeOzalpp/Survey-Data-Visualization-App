import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useUiStore } from "../../app/state/ui-store";
import { useSurveyDataStore } from "../../app/state/survey-data-store";
import { Modal } from "../../app/ui/Modal";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import { CHOOSE_STAFF, CHOOSE_STUDENT, GO_BACK, useGraphPickerData } from "../graph-picker/gp-data";
import WidgetSectionNav from "../widgets/widget-section-nav";
import "../../styles/city-stats.css";

const AUTOPLAY_MS = 5000;

interface LocalSectionState {
  sourceSection: string;
  sourceSelectionVersion: number;
  value: string;
}

export default function CityStatsDialog() {
  const open = useUiStore((s) => s.cityStatsOpen);
  const setOpen = useUiStore((s) => s.setCityStatsOpen);

  const closeDialog = useCallback(() => { setOpen(false); }, [setOpen]);

  const { section, sectionSelectionVersion } = useSurveyDataStore(
    useShallow((s) => ({ section: s.section, sectionSelectionVersion: s.sectionSelectionVersion }))
  );
  const { ALL_LABELS, MAIN_OPTS, STUDENT_OPTS, STAFF_OPTS, counts } = useGraphPickerData(section);
  const [paused, setPaused] = useState(true);

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
    if (!open || paused || cycleSections.length <= 1) return;
    const timer = window.setInterval(() => {
      const currentIndex = cycleSections.findIndex((item) => item.id === localSection);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % cycleSections.length : 0;
      setLocalSection(cycleSections[nextIndex].id);
    }, AUTOPLAY_MS);
    return () => { window.clearInterval(timer); };
  }, [open, paused, cycleSections, localSection, setLocalSection]);

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

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      ariaLabelledBy="city-stats-dialog-title"
      shellClassName="city-stats-dialog-shell"
      cardClassName="city-stats-dialog"
      overlayLabel="Close city stats"
    >
      <header className="city-stats-dialog-header">
        <h3 id="city-stats-dialog-title" className="city-stats-dialog-title">City stats</h3>
        <button
          type="button"
          className="ui-icon-nav-button city-stats-dialog-close"
          aria-label="Close city stats"
          onClick={closeDialog}
        >
          <CloseIcon className="ui-close" />
        </button>
      </header>

      <WidgetSectionNav
        title={currentSectionLabel}
        paused={paused}
        className="city-stats-dialog-nav"
        onPrevious={() => { stepSection(-1); }}
        onNext={() => { stepSection(1); }}
        onTogglePaused={() => { setPaused((p) => !p); }}
      />

      <div className="city-stats-dialog-body" />
    </Modal>
  );
}
