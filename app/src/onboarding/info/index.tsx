import { Fragment, useCallback, useEffect, useRef, useState } from "react";

import CloseIcon from "../assets/svg/close/CloseIcon";
import PlayPauseIcon from "../assets/svg/play/PlayPauseIcon";
import { usePreferences } from "../app/state/preferences-context";
import { useUiStore } from "../app/state/ui-store";
import { Modal } from "../app/ui/Modal";
import "../styles/info.css";
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

  // Decide the format ourselves via canPlayType (a synchronous, no-network
  // capability check) instead of handing the browser two <source> candidates
  // to fall back between: on-device logs showed Safari picking the WebM
  // source, failing to decode it (MEDIA_ERR_DECODE), and never advancing to
  // the MP4 source at all — the native multi-<source> fallback just doesn't
  // reliably happen here. Browsers that truly support WebM still get it;
  // Safari gets routed straight to MP4 without ever touching the WebM file.
  // TEMP: force MP4-only to verify the fallback path works in isolation.
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

  // Not gated on `open`: InfoDialog is always mounted (hidden via CSS, see
  // the `is-open` class below) rather than conditionally rendered, so the
  // <video> element already exists in the DOM before the user ever taps
  // "Watch how it works" — fetching media on mount means a real src is
  // already in place by the time that tap happens, which main.tsx's onClick
  // relies on to prime playback synchronously within the click itself.
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
  // Falls back to any available slide's media so the persistent <video>
  // below always has something to prime with the very first "open" tap,
  // even before the user has reached a slide that actually has media.
  const displayMedia = slideMedia ?? Object.values(mediaBySlide)[0];

  useEffect(() => {
    setMediaLoaded(false);
  }, [slide.key, darkMode]);

  // Combines two mechanisms: the declarative `autoplay` attribute (which
  // WebKit exempts from user-gesture rules entirely when muted+playsInline —
  // it's not a script action, so it isn't subject to activation checks the
  // way element.play() is) drives actual playback; this effect only nudges
  // genuinely-stalled loading (explicit load(), retried at 2.5s/5s if stuck)
  // and opportunistically calls play() as a bonus, not the primary trigger.
  // Earlier, JS-triggered play() calls issued from an auto-advance (a CSS
  // animationend, not a real click) were rejected with NotAllowedError even
  // though the video is muted — `autoplay` sidesteps that entirely. The
  // <video> element itself is never recreated across slide changes (no
  // `key` prop) so it keeps whatever playback permission it already has,
  // rather than starting over as an unlocked-from-scratch element each time.
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
      shellClassName="info-dialog-shell"
      cardClassName="info-dialog"
      overlayLabel="Close more information"
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
          data-slide-key={slide.key}
        >
          <p>
            {slide.copy.map((line, index) => (
              <Fragment key={line}>
                {index > 0 && <br className="info-dialog-copy-break" />}
                {line}
              </Fragment>
            ))}
          </p>
          {displayMedia && (
            <figure
              className={`info-dialog-media${mediaLoaded ? "" : " is-loading"}`}
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

      <div className="ui-icon-nav info-dialog-slider-controls" aria-label="More information slides">
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
        </div>

        <div className="info-dialog-control-cluster">
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

          <button
            type="button"
            className="ui-icon-nav-button info-dialog-pause"
            aria-pressed={paused}
            aria-label={paused ? "Resume information slides" : "Pause information slides"}
            onClick={() => { setPaused((current) => !current); }}
          >
            <PlayPauseIcon mode={paused ? "play" : "pause"} className="ui-icon" />
          </button>

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
    </Modal>
  );
}
