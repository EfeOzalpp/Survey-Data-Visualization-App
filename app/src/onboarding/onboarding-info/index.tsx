import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import CloseIcon from "../../assets/svg/close/CloseIcon";
import PlayPauseIcon from "../../assets/svg/play/PlayPauseIcon";
import ChevronIcon from "../../assets/svg/chevron/ChevronIcon";
import { usePreferences } from "../../app-core/state/preferences-context";
import { useUiStore } from "../../app-core/state/ui-store";
import { Modal } from "../../app-core/ui-generics/Modal";
import styles from "./onboarding-info.module.css";
import { INFO_SLIDES, readInfoSlideMedia, type InfoSlideMediaMap } from "./slides";

const SLIDE_DURATION_MS = 10000;

export default function InfoDialog() {
  const open = useUiStore((state) => state.infoOpen);
  const setInfoOpen = useUiStore((state) => state.setInfoOpen);
  const { darkMode } = usePreferences();
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progressCycle, setProgressCycle] = useState(0);
  const [mediaBySlide, setMediaBySlide] = useState<InfoSlideMediaMap>({});
  const [mediaLoaded, setMediaLoaded] = useState(false);


  const [preferWebm] = useState(() => false);
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

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("info-dialog-scroll-lock");
    return () => {
      document.documentElement.classList.remove("info-dialog-scroll-lock");
    };
  }, [open]);

  useEffect(() => {
    let active = true;

    void readInfoSlideMedia()
      .then((media) => {
        if (active) setMediaBySlide(media);
      })
      .catch((error: unknown) => {
        console.warn("[info-media] Using slides without CMS media", error);
      });

    return () => {
      active = false;
    };
  }, []);

  const slide = INFO_SLIDES[activeSlide];
  const slideMedia = mediaBySlide[slide.key];
  const displayMedia = slideMedia ?? Object.values(mediaBySlide)[0];

  useEffect(() => {
    setMediaLoaded(false);
  }, [slide.key, darkMode]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !displayMedia) return;

    node.muted = true;
    node.defaultMuted = true;

    let retryTimer: number | null = null;
    let promoteTimer: number | null = null;
    const clearTimers = () => {
      if (retryTimer !== null) { window.clearTimeout(retryTimer); retryTimer = null; }
      if (promoteTimer !== null) { window.clearTimeout(promoteTimer); promoteTimer = null; }
    };

    const kickLoad = () => { node.load(); };

    const tryPlay = () => {
      if (node.muted && node.playsInline && node.paused && node.readyState >= 2) {
        void node.play().catch(() => {
          // Autoplay can be legitimately refused in some contexts; nothing to do.
        });
      }
    };

    const onLoadedData = () => { setMediaLoaded(true); tryPlay(); };
    const onCanPlay = () => { tryPlay(); };

    kickLoad();
    retryTimer = window.setTimeout(() => {
      if (node.readyState < 2) kickLoad();
    }, 2500);
    promoteTimer = window.setTimeout(() => {
      if (node.readyState < 2) {
        node.preload = "auto";
        node.load();
      }
    }, 5000);

    node.addEventListener("loadeddata", onLoadedData);
    node.addEventListener("canplay", onCanPlay);

    return () => {
      clearTimers();
      node.removeEventListener("loadeddata", onLoadedData);
      node.removeEventListener("canplay", onCanPlay);
    };
  }, [slide.key, darkMode, displayMedia]);

  return (
    <Modal
      open={open}
      onOpenChange={setInfoOpen}
      ariaLabelledBy="info-dialog-title"
      ariaDescribedBy="info-dialog-copy"
      shellClassName={styles.shell}
      cardClassName={styles.dialog}
      overlayLabel="Close more information"
    >
      <header className={styles.header}>
        <h3
          id="info-dialog-title"
          className={styles.title}
          aria-label={`Slide ${String(activeSlide + 1)} of ${String(INFO_SLIDES.length)}: ${slide.title}`}
        >
          <span>{String(activeSlide + 1).padStart(2, "0")} / {String(INFO_SLIDES.length).padStart(2, "0")}</span>
          <span aria-hidden="true">-</span>
          <span>{slide.title}</span>
        </h3>
        <button
          type="button"
          className="ui-icon-nav-button"
          aria-label="Close more information"
          onClick={closeDialog}
        >
          <CloseIcon className="ui-close svg-sm" />
        </button>
      </header>

      <div id="info-dialog-copy" className={styles.copy}>
        <section
          className={`${styles.slide}${slideMedia ? ` ${styles.hasMedia}` : ""}`}
          role="group"
          aria-roledescription="slide"
          aria-label={`${String(activeSlide + 1)} of ${String(INFO_SLIDES.length)}`}
          data-slide-key={slide.key}
        >
          <p>
            {slide.copy.map((line, index) => (
              <Fragment key={line}>
                {index > 0 && <br className={styles.copyBreak} />}
                {line}
              </Fragment>
            ))}
          </p>
          {displayMedia && (
            <figure
              className={`${styles.media}${mediaLoaded ? "" : ` ${styles.isLoading}`}`}
              style={{ opacity: slideMedia ? 1 : 0 }}
            >
              <video
                ref={videoRef}
                data-info-video-primer="true"
                aria-label={darkMode ? displayMedia.darkAlt : displayMedia.lightAlt}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                style={{ pointerEvents: "none" }}
              >
                <source
                  src={
                    preferWebm
                      ? (darkMode ? displayMedia.darkVideoUrl : displayMedia.lightVideoUrl)
                      : (darkMode ? displayMedia.darkVideoMp4Url : displayMedia.lightVideoMp4Url)
                  }
                  type={preferWebm ? "video/webm" : "video/mp4"}
                />
              </video>
            </figure>
          )}
        </section>
      </div>

      <div className={`ui-icon-nav ${styles.sliderControls}`} aria-label="More information slides">
        <div className={styles.timeline}>
          <div className={styles.progress} role="group" aria-label="Choose an information slide">
            {INFO_SLIDES.map((item, index) => {
              const complete = index < activeSlide;
              const active = index === activeSlide;

              return (
                <button
                  key={item.title}
                  type="button"
                  className={styles.progressButton}
                  aria-label={`Show slide ${String(index + 1)}: ${item.title}`}
                  aria-current={active ? "step" : undefined}
                  onClick={() => { selectSlide(index); }}
                >
                  <span className={styles.progressTrack} aria-hidden="true">
                    <span
                      key={active ? `${String(activeSlide)}-${String(progressCycle)}` : item.title}
                      className={`${styles.progressFill}${complete ? ` ${styles.isComplete}` : ""}${active ? ` ${styles.isActive}` : ""}`}
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
        </div>

        <div className={styles.controlCluster}>
          <button
            type="button"
            className="ui-icon-nav-button"
            aria-label="Previous information slide"
            onClick={() => { changeSlide(-1); }}
          >
            <ChevronIcon direction="previous" className="ui-icon svg-md" />
          </button>

          <button
            type="button"
            className="ui-icon-nav-button"
            aria-pressed={paused}
            aria-label={paused ? "Resume information slides" : "Pause information slides"}
            onClick={() => { setPaused((current) => !current); }}
          >
            <PlayPauseIcon mode={paused ? "play" : "pause"} className="ui-icon svg-md" />
          </button>

          <button
            type="button"
            className="ui-icon-nav-button"
            aria-label="Next information slide"
            onClick={() => { changeSlide(1); }}
          >
            <ChevronIcon direction="next" className="ui-icon svg-md" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
