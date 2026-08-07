
// src/onboarding/information/canvas-info.tsx

import React, { Suspense, startTransition, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import LinkIcon from "../../assets/svg/link/LinkIcon";
import PlayPauseIcon from "../../assets/svg/play/PlayPauseIcon";
import { useCanvasRuntimeStore } from "../../app/state/canvas-runtime-store";

const SpotlightEntry = React.lazy(() => import("../../canvas-instances/SpotlightEntry"));

// Fallback cap only - on an idle browser this fires almost immediately via
// requestIdleCallback instead of always eating the full flat delay (same
// local-helper pattern as app-effects.tsx's scheduleIdle / index.tsx's
// scheduleStartupWork - each file keeps its own since the timeouts differ).
const SPOTLIGHT_LOAD_TIMEOUT_MS = 800;
const SPOTLIGHT_INTERSECTION_THRESHOLD = 0.1;

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
}

function scheduleIdle(callback: () => void, timeout: number) {
  const idleWindow = window as unknown as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout });
    return () => { idleWindow.cancelIdleCallback?.(handle); };
  }
  const id = window.setTimeout(callback, timeout);
  return () => { window.clearTimeout(id); };
}

export default function CanvasInfo() {
  const {
    spotlightLiveAvg,
    setSpotlightLiveAvg,
    spotlight,
    previousSpotlight,
    nextSpotlight,
    toggleSpotlightPaused,
  } = useCanvasRuntimeStore(
    useShallow((s) => ({
      spotlightLiveAvg: s.spotlightLiveAvg,
      setSpotlightLiveAvg: s.setSpotlightLiveAvg,
      spotlight: s.spotlight,
      previousSpotlight: s.previousSpotlight,
      nextSpotlight: s.nextSpotlight,
      toggleSpotlightPaused: s.toggleSpotlightPaused,
    }))
  );

  const asideRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [loadDelayComplete, setLoadDelayComplete] = useState(false);
  const [spotlightReady, setSpotlightReady] = useState(false);
  // One-way latch: once loaded and seen at least once, stays mounted even if
  // scrolled out of view later. Set during render (React's sanctioned pattern
  // for state that depends on other state) rather than in an effect, since
  // this doesn't synchronize with anything external.
  if (!spotlightReady && loadDelayComplete && inView) {
    setSpotlightReady(true);
  }

  useEffect(() => {
    const el = asideRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      startTransition(() => {
        setInView(true);
      });
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= SPOTLIGHT_INTERSECTION_THRESHOLD;
        startTransition(() => {
          setInView(visible);
        });
      },
      // rootMargin extends the trigger zone well past the real viewport, so
      // this fires - and the lazy import + load-delay timer below start -
      // while the frame is still off-screen, not only once it's already
      // visible. By the time the user actually scrolls to it, it's ready.
      { threshold: SPOTLIGHT_INTERSECTION_THRESHOLD, rootMargin: "800px 0px" }
    );
    observer.observe(el);
    return () => { observer.disconnect(); };
  }, []);

  useEffect(() => {
    return scheduleIdle(() => {
      startTransition(() => {
        setLoadDelayComplete(true);
      });
    }, SPOTLIGHT_LOAD_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (spotlight.paused || !inView) return;
    if (!spotlightReady) return;

    const id = window.setInterval(() => {
      nextSpotlight();
    }, 4500);

    return () => {
      window.clearInterval(id);
    };
  }, [nextSpotlight, spotlight.index, spotlight.paused, inView, spotlightReady]);

  return (
    <aside ref={asideRef} className="onboarding-info canvas-info" aria-label="Scene Canvas information">
      <section className="canvas-info__slider" aria-label="Scene Canvas preview">
        <div className="canvas-info__spotlight-frame">
          {spotlightReady ? (
            <Suspense fallback={<div id="spotlight-canvas-root" className="canvas-info__spotlight-canvas" aria-hidden="true" />}>
              <SpotlightEntry spotlight={spotlight} liveAvg={spotlightLiveAvg} />
            </Suspense>
          ) : (
            <div id="spotlight-canvas-root" className="canvas-info__spotlight-canvas" aria-hidden="true" />
          )}
          <div className="ui-icon-nav canvas-info__slider-controls" aria-label="Scene Canvas preview controls">
            <div className="canvas-info__liveavg-control">
              <input
                className="canvas-info__liveavg-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={spotlightLiveAvg}
                aria-label="Preview intensity"
                onChange={(event) => {
                  setSpotlightLiveAvg(Number(event.currentTarget.value));
                }}
              />
            </div>
            <button type="button" className="ui-icon-nav-button canvas-info__slider-button" aria-label="Previous preview" onClick={previousSpotlight}>
              <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18L9 12L15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="ui-icon-nav-button canvas-info__slider-button canvas-info__slider-button--pause"
              aria-pressed={spotlight.paused}
              aria-label={spotlight.paused ? "Resume preview" : "Pause preview"}
              onClick={toggleSpotlightPaused}
            >
              <PlayPauseIcon mode={spotlight.paused ? "play" : "pause"} className="ui-icon" />
            </button>
            <button type="button" className="ui-icon-nav-button canvas-info__slider-button" aria-label="Next preview" onClick={nextSpotlight}>
              <svg className="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 18L15 12L9 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section className="canvas-info__information">
        <div className="canvas-info-div">
          <h3 className="canvas-info__eyebrow">Built With a Custom Graphics Renderer</h3>
          <ul className="canvas-info__copy">
            <li>Butterfly Effect's city runs on a custom scene system, built on top of the Canvas2D API.</li>
            <li>It's the predecessor of Canvas Engine, a more complete renderer for interactive visual tools I'm building.</li>
            <li>Let's collaborate on GitHub. You can also reach out at efe.ozalp@canvas-engine.com.</li>
          </ul>
          <div className="canvas-info__actions">
            <a
              className="canvas-engine-link"
              href="https://github.com/EfeOzalpp/canvas-engine"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Canvas Engine repository"
              data-label="Canvas Engine"
            >
              <span className="canvas-engine-link__ghost" aria-hidden="true">
                <LinkIcon />
                Canvas Engine
              </span>
              <span className="canvas-engine-link__inner">
                <LinkIcon />
                Canvas Engine
              </span>
            </a>
          </div>
        </div>
      </section>
    </aside>
  );
}
