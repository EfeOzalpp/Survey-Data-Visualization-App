import PlayPauseIcon from "../../assets/svg/play/PlayPauseIcon";
import ChevronIcon from "../../assets/svg/chevron/ChevronIcon";
import styles from "./widgets.module.css";

export interface WidgetsHeaderProps {
  title: string;
  paused: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePaused: () => void;
}

export default function WidgetsHeader({
  title,
  paused,
  onPrevious,
  onNext,
  onTogglePaused,
}: WidgetsHeaderProps) {
  return (
    <div className={`ui-icon-nav ${styles.header}`}>
      <button
        type="button"
        className="ui-icon-nav-button"
        aria-label="Previous section"
        onClick={onPrevious}
      >
        <ChevronIcon direction="previous" />
      </button>
      <div className={styles.sectionTitle} title={title}>{title}</div>
      <button
        type="button"
        className="ui-icon-nav-button"
        aria-label="Next section"
        onClick={onNext}
      >
        <ChevronIcon direction="next" />
      </button>
      <button
        type="button"
        className={`ui-icon-nav-button ${styles.pauseButton}`}
        aria-pressed={paused}
        aria-label={paused ? "Resume section autoplay" : "Pause section autoplay"}
        onClick={onTogglePaused}
      >
        <PlayPauseIcon mode={paused ? "play" : "pause"} className="ui-icon svg-sm" />
      </button>
    </div>
  );
}
