import CloseIcon from "../../../assets/svg/close/CloseIcon";
import styles from "../widgets.module.css";

// Desktop-only close row. CompactToolsPanel puts its close control in each
// compact header and only takes MultiButtonFooter from this folder.
interface CloseFooterProps {
  onClose: () => void;
  ariaLabel?: string;
}

export function CloseFooter({ onClose, ariaLabel = "Close widgets" }: CloseFooterProps) {
  return (
    <div className={styles.closeFooter}>
      <button
        type="button"
        className="ui-icon-nav-button"
        aria-label={ariaLabel}
        onClick={onClose}
      >
        <CloseIcon className="ui-close svg-sm" />
      </button>
    </div>
  );
}

export default CloseFooter;
