import React, { Profiler } from "react";
import NavLeft from "./left/nav-left";
import NavRight from "./right/nav-right";
import NavBottom from "./bottom/nav-bottom";
import { usePreferences } from "../app/state/preferences-context";
import { useIdentity } from "../app/state/identity-context";
import { useShallow } from "zustand/react/shallow";
import { useUiStore } from "../app/state/ui-store";
import { profilerOnRender, recordOwnRender } from "../dev/renderProfilerStats";
import "../styles/navigation.css";

const PLACEMENT_TRANSITION_MS = 220;

const Navigation = () => {
  recordOwnRender("Navigation");
  const { darkMode } = usePreferences();
  const {
    vizVisible,
    questionnaireOpen,
    cityPanelOpen,
    animationVisible,
    hasCompletedSurvey,
    observerMode,
  } = useUiStore(
    useShallow((s) => ({
      vizVisible: s.vizVisible,
      questionnaireOpen: s.questionnaireOpen,
      cityPanelOpen: s.cityPanelOpen,
      animationVisible: s.animationVisible,
      hasCompletedSurvey: s.hasCompletedSurvey,
      observerMode: s.observerMode,
    }))
  );
  const { myEntryId, mySection } = useIdentity();
  const [introActive, setIntroActive] = React.useState(true);
  const navRef = React.useRef<HTMLElement | null>(null);
  const previousPlacementRef = React.useRef<"centered" | "spread" | null>(null);
  const previousRectsRef = React.useRef<{ left: DOMRect; right: DOMRect } | null>(null);
  const transitionFrameRef = React.useRef<number | null>(null);
  const transitionTimeoutRef = React.useRef<number | null>(null);

  const savedEntryId = myEntryId;
  const savedSection = mySection;
  const savedHomeCityOpen =
    cityPanelOpen &&
    !!savedEntryId &&
    !!savedSection &&
    !questionnaireOpen &&
    !vizVisible &&
    !animationVisible &&
    !hasCompletedSurvey &&
    !observerMode;
  const isLandingState =
    !vizVisible &&
    !questionnaireOpen &&
    !animationVisible &&
    (!cityPanelOpen || savedHomeCityOpen);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setIntroActive(false);
    }, 520);
    return () => { window.clearTimeout(timer); };
  }, []);

  React.useLayoutEffect(() => {
    const navEl = navRef.current;
    const leftEl = navEl?.querySelector<HTMLElement>(".left");
    const rightEl = navEl?.querySelector<HTMLElement>(".right");
    if (!navEl || !leftEl || !rightEl) return;

    const clearMotion = () => {
      leftEl.style.transition = "";
      leftEl.style.transform = "";
      rightEl.style.transition = "";
      rightEl.style.transform = "";
    };

    if (transitionFrameRef.current !== null) {
      window.cancelAnimationFrame(transitionFrameRef.current);
      transitionFrameRef.current = null;
    }
    if (transitionTimeoutRef.current !== null) {
      window.clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }

    clearMotion();

    const nextPlacement = isLandingState ? "centered" : "spread";
    const previousPlacement = previousPlacementRef.current;
    const previousRects = previousRectsRef.current;
    const nextRects = {
      left: leftEl.getBoundingClientRect(),
      right: rightEl.getBoundingClientRect(),
    };
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const shouldAnimateOut =
      !introActive &&
      !prefersReducedMotion &&
      previousPlacement === "centered" &&
      nextPlacement === "spread" &&
      !!previousRects;

    if (shouldAnimateOut) {
      const motions = [
        { el: leftEl, deltaX: previousRects.left.left - nextRects.left.left },
        { el: rightEl, deltaX: previousRects.right.left - nextRects.right.left },
      ].filter(({ deltaX }) => Math.abs(deltaX) > 0.5);

      if (motions.length > 0) {
        motions.forEach(({ el, deltaX }) => {
          el.style.transition = "none";
          el.style.transform = `translateX(${String(Math.round(deltaX * 100) / 100)}px)`;
        });

        navEl.getBoundingClientRect();

        transitionFrameRef.current = window.requestAnimationFrame(() => {
          motions.forEach(({ el }) => {
            el.style.transition = `transform ${String(PLACEMENT_TRANSITION_MS)}ms cubic-bezier(.22,.61,.36,1)`;
            el.style.transform = "translateX(0px)";
          });
          transitionFrameRef.current = null;
        });

        transitionTimeoutRef.current = window.setTimeout(() => {
          clearMotion();
          transitionTimeoutRef.current = null;
        }, PLACEMENT_TRANSITION_MS + 40);
      }
    }

    previousPlacementRef.current = nextPlacement;
    previousRectsRef.current = nextRects;

    return () => {
      if (transitionFrameRef.current !== null) {
        window.cancelAnimationFrame(transitionFrameRef.current);
        transitionFrameRef.current = null;
      }
      if (transitionTimeoutRef.current !== null) {
        window.clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, [isLandingState, introActive]);

  return (
    <>
      <nav
        ref={navRef}
        className={`navigation${isLandingState ? " is-landing-centered" : ""}`}
      >
        <NavLeft introActive={introActive} />
        <Profiler id="NavRight" onRender={profilerOnRender}>
          <NavRight isDark={darkMode} introActive={introActive} />
        </Profiler>
      </nav>
      <Profiler id="NavBottom" onRender={profilerOnRender}>
        <NavBottom introActive={introActive} />
      </Profiler>
    </>
  );
};

export default React.memo(Navigation);
