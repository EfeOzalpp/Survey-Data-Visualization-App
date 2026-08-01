import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import CloseIcon from "../../assets/svg/close/CloseIcon";
import PlayPauseIcon from "../../assets/svg/play/PlayPauseIcon";
import { usePreferences } from "../../app/state/preferences-context";
import { useUiStore } from "../../app/state/ui-store";
import { useEscapeToClose } from "../../lib/hooks/useEscapeToClose";
import { useFocusTrap } from "../../lib/hooks/useFocusTrap";
import "../../styles/info.css";
import { INFO_SLIDES, readInfoSlideMedia, type InfoSlideMediaMap } from "./slides";

const SLIDE_DURATION_MS = 10000;

export default function InfoDialog() {
  const open = useUiStore((state) => state.infoOpen);
  const setInfoOpen = useUiStore((state) => state.setInfoOpen);
  const { darkMode } = usePreferences();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressCycle, setProgressCycle] = useState(0);
  const [mediaBySlide, setMediaBySlide] = useState<InfoSlideMediaMap>({});
  const closeDialog = useCallback(() => {
    setInfoOpen(false);
  }, [setInfoOpen]);

  const selectSlide = useCallback((index: number) => {
    const normalizedIndex = (index + INFO_SLIDES.length) % INFO_SLIDES.length;
    setActiveSlide(normalizedIndex);
    setProgressCycle((cycle) => cycle + 1);
  }, []);

  const changeSlide = useCallback((offset: number) => {
    setActiveSlide((current) => (current + offset + INFO_SLIDES.length) % INFO_SLIDES.length);
    setProgressCycle((cycle) => cycle + 1);
  }, []);

  useEscapeToClose(open, closeDialog);
  useFocusTrap({ enabled: open, containerRef: dialogRef });

  useEffect(() => {
    if (!open) return;
    let active = true;

    void readInfoSlideMedia()
      .then((media) => {
        if (active) setMediaBySlide(media);
      })
      .catch((error: unknown) => {
        console.warn("[product-tour-media] Using slides without CMS media", error);
      });

    return () => {
      active = false;
    };
  }, [open]);

  const slide = INFO_SLIDES[activeSlide];
  const slideMedia = mediaBySlide[slide.key];

  const dialog = (
    <div className={`info-dialog-root${open ? " is-open" : ""}`} aria-hidden={!open}>
      <button
        type="button"
        className="info-dialog-overlay"
        aria-label="Close more information"
        tabIndex={-1}
        onClick={closeDialog}
      />

      <div className="info-dialog-shell">
        <div
          ref={dialogRef}
          className="info-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="info-dialog-title"
          aria-describedby="info-dialog-copy"
        >
          <header className="info-dialog-header">
            <h3
              id="info-dialog-title"
              className="info-dialog-title"
              aria-label={`Slide ${String(activeSlide + 1)} of ${String(INFO_SLIDES.length)}: ${slide.title}`}
            >
              <span>{String(activeSlide + 1).padStart(2, "0")} / {String(INFO_SLIDES.length).padStart(2, "0")}</span>
              <span aria-hidden="true">-</span>
              <span>{slide.title}</span>
            </h3>
            <button
              type="button"
              className="ui-icon-nav-button info-dialog-close"
              aria-label="Close more information"
              onClick={closeDialog}
            >
              <CloseIcon className="ui-close" />
            </button>
          </header>

          <div id="info-dialog-copy" className="info-dialog-copy">
            <section
              className={`info-dialog-slide${slideMedia ? " has-media" : ""}`}
              role="group"
              aria-roledescription="slide"
              aria-label={`${String(activeSlide + 1)} of ${String(INFO_SLIDES.length)}`}
            >
              {slideMedia && (
                <figure className="info-dialog-media">
                  <img
                    key={`${slide.key}-${darkMode ? "dark" : "light"}`}
                    src={darkMode ? slideMedia.darkGifUrl : slideMedia.lightGifUrl}
                    alt={slideMedia.alt}
                    decoding="async"
                  />
                </figure>
              )}
              <p>{slide.copy}</p>
            </section>
          </div>

          <div className="ui-icon-nav info-dialog-slider-controls" aria-label="More information slides">
            <button
              type="button"
              className="ui-icon-nav-button info-dialog-slider-button"
              aria-label="Previous information slide"
              onClick={() => { changeSlide(-1); }}
            >
              <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18L9 12L15 6" />
              </svg>
            </button>

            <div className="info-dialog-timeline">
              <div className="info-dialog-progress" role="group" aria-label="Choose an information slide">
                {INFO_SLIDES.map((item, index) => {
                  const complete = index < activeSlide;
                  const active = index === activeSlide;

                  return (
                    <button
                      key={item.title}
                      type="button"
                      className="info-dialog-progress-button"
                      aria-label={`Show slide ${String(index + 1)}: ${item.title}`}
                      aria-current={active ? "step" : undefined}
                      onClick={() => { selectSlide(index); }}
                    >
                      <span className="info-dialog-progress-track" aria-hidden="true">
                        <span
                          key={active ? `${String(activeSlide)}-${String(progressCycle)}` : item.title}
                          className={`info-dialog-progress-fill${complete ? " is-complete" : ""}${active ? " is-active" : ""}`}
                          style={active ? {
                            animationDuration: `${String(SLIDE_DURATION_MS)}ms`,
                            animationPlayState: open && !paused ? "running" : "paused",
                          } : undefined}
                          onAnimationEnd={active ? () => { changeSlide(1); } : undefined}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="ui-icon-nav-button info-dialog-pause"
                aria-pressed={paused}
                aria-label={paused ? "Resume information slides" : "Pause information slides"}
                onClick={() => { setPaused((current) => !current); }}
              >
                <PlayPauseIcon mode={paused ? "play" : "pause"} className="ui-icon" />
              </button>
            </div>

            <button
              type="button"
              className="ui-icon-nav-button info-dialog-slider-button"
              aria-label="Next information slide"
              onClick={() => { changeSlide(1); }}
            >
              <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18L15 12L9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(dialog, document.body) : dialog;
}
