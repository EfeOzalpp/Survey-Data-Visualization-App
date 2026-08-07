import { useCallback } from "react";

import { useUiStore } from "../../app/state/ui-store";
import { Modal } from "../../app/ui/Modal";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import "../../styles/city-stats.css";

// Placeholder dialog for now - the section-cycling nav (WidgetSectionNav,
// same one BarGraph/ByQuestion use) was removed along with the data wiring
// it needed since there's no per-section content to cycle through yet.
export default function CityStatsDialog() {
  const open = useUiStore((s) => s.cityStatsOpen);
  const setOpen = useUiStore((s) => s.setCityStatsOpen);

  const closeDialog = useCallback(() => { setOpen(false); }, [setOpen]);

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

      <div className="city-stats-dialog-body">
        <p className="city-stats-dialog-placeholder">Coming soon.</p>
      </div>
    </Modal>
  );
}
