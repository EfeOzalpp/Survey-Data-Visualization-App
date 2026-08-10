import { useCallback } from "react";

import { useUiStore } from "../../app/state/ui-store";
import { Modal } from "../../app/ui/Modal";
import CloseIcon from "../../assets/svg/close/CloseIcon";
import styles from "./city-stats.module.css";

// Placeholder dialog for now - the section-cycling nav (WidgetsHeader,
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
      shellClassName={styles.dialogShell}
      cardClassName={styles.dialog}
      overlayLabel="Close city stats"
    >
      <header className={styles.header}>
        <h3 id="city-stats-dialog-title" className={styles.title}>City stats</h3>
        <button
          type="button"
          className={`ui-icon-nav-button ${styles.close}`}
          aria-label="Close city stats"
          onClick={closeDialog}
        >
          <CloseIcon className="ui-close svg-sm" />
        </button>
      </header>

      <div className={styles.body}>
        <p className={styles.placeholder}>Coming soon.</p>
      </div>
    </Modal>
  );
}
