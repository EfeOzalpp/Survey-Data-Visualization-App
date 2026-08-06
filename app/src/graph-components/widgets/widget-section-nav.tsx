import PlayPauseIcon from "../../../assets/svg/play/PlayPauseIcon";

interface WidgetSectionNavProps {
  title: string;
  paused: boolean;
  className?: string;
  onPrevious: () => void;
  onNext: () => void;
  onTogglePaused: () => void;
}

function classes(...names: (string | false | null | undefined)[]) {
  return names.filter(Boolean).join(" ");
}

export default function WidgetSectionNav({
  title,
  paused,
  className,
  onPrevious,
  onNext,
  onTogglePaused,
}: WidgetSectionNavProps) {
  return (
    <div className={classes("ui-icon-nav widget-section-nav", className)}>
      <button
        type="button"
        className="ui-icon-nav-button widget-section-nav-btn"
        aria-label="Previous section"
        onClick={onPrevious}
      >
        <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18L9 12L15 6" />
        </svg>
      </button>
      <div className="widget-section-nav-title" title={title}>{title}</div>
      <button
        type="button"
        className="ui-icon-nav-button widget-section-nav-btn"
        aria-label="Next section"
        onClick={onNext}
      >
        <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18L15 12L9 6" />
        </svg>
      </button>
      <button
        type="button"
        className="ui-icon-nav-button widget-section-nav-btn widget-section-nav-btn--pause"
        aria-pressed={paused}
        aria-label={paused ? "Resume section autoplay" : "Pause section autoplay"}
        onClick={onTogglePaused}
      >
        <PlayPauseIcon mode={paused ? "play" : "pause"} className="ui-icon" />
      </button>
    </div>
  );
}
