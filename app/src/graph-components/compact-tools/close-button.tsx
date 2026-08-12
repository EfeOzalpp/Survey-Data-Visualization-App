import CloseIcon from "../../assets/svg/close/CloseIcon";
import styles from "./compact-tools.module.css";

interface CloseButtonProps {
  onClose: () => void;
}

export function CloseButton({ onClose }: CloseButtonProps) {
  return (
    <div className={styles.closeButtonWrap}>
      <div className={styles.closeButtonDivider} aria-hidden="true" />
      <button
        type="button"
        className={`ui-icon-nav-button ${styles.closeButton}`}
        aria-label="Close graph tools"
        onClick={onClose}
      >
        <CloseIcon className="ui-close svg-sm" />
      </button>
      <div className={styles.closeButtonDivider} aria-hidden="true" />
    </div>
  );
}

export default CloseButton;
