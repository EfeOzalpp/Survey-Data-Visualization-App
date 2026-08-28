// src/app-core/app-effects.tsx
// Browser-only app shell effects live here so main.tsx stays readable.

import React, { Suspense, useEffect, useRef, useState } from "react";

import { USE_MOCK_READS } from "../client-api/read-api/config";
import { useSurveyStreamStatus } from "../client-api/read-api/surveyStreamStatus";
import { usePreventPageZoomOutsideZones } from "../lib/hooks/usePreventPageZoom";
import HintBanner from "./ui-generics/HintBanner";
import {
  listenForDuplicateSurveyNotice,
  listenForRateLimitNotice,
  type RateLimitNoticeDetail,
} from "./notices";

const GamificationCopyPreloader = React.lazy(() =>
  import("../lib/hooks/useGamificationTextPreload")
);

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: Window["setTimeout"];
  clearTimeout: Window["clearTimeout"];
}

interface AppBrowserPoliciesProps {
  questionnaireOpen: boolean;
  vizVisible: boolean;
}

function scheduleIdle(callback: () => void, timeout = 1500) {
  if (typeof window === "undefined") return undefined;

  const idleWindow = window as unknown as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout });
    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const timer = idleWindow.setTimeout(callback, timeout);
  return () => {
    idleWindow.clearTimeout(timer);
  };
}

export function DeferredGraphPreloader() {
  useEffect(() => {
    const timer = setTimeout(() => {
      scheduleIdle(() => {
        void import('../graph-runtime/dotgraph/data-boundary');
      });
    }, 6000);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return null;
}

export function DeferredGamificationPreloader() {
  const [start, setStart] = useState<boolean>(false);

  useEffect(() => {
    const cancelIdle = scheduleIdle(() => {
      setStart(true);
    });
    return () => {
      cancelIdle?.();
    };
  }, []);

  return start ? (
    <Suspense fallback={null}>
      <GamificationCopyPreloader />
    </Suspense>
  ) : null;
}

export function AppBrowserPolicies({
  questionnaireOpen,
  vizVisible,
}: AppBrowserPoliciesProps) {
  const zoomAllowedZones = questionnaireOpen
    ? [
        "[data-graph-container]",
        "#questionnaire-canvas-root",
        "#city-canvas-root",
      ]
    : [
        "[data-graph-container]",
        "#canvas-root",
        "#questionnaire-canvas-root",
        "#city-canvas-root",
      ];

  usePreventPageZoomOutsideZones({
    allowWithin: zoomAllowedZones,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !vizVisible) return;
    // When users leave the graph, the onboarding canvas is likely next.
    return scheduleIdle(() => {
      void import("../scene-canvas-instances/QuestionnaireEntry");
    });
  }, [vizVisible]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;

    if (vizVisible) {
      // The graph owns the viewport while mounted; page scroll fights the camera.
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    }

    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [vizVisible]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (questionnaireOpen) {
      document.documentElement.classList.add("questionnaire-scroll-lock");
    }
    return () => {
      document.documentElement.classList.remove("questionnaire-scroll-lock");
    };
  }, [questionnaireOpen]);

  return null;
}

export function SurveyDataStatusBanner() {
  const streamStatus = useSurveyStreamStatus();
  const reconnecting = streamStatus === "reconnecting";

  return (
    <HintBanner
      visible={USE_MOCK_READS || reconnecting}
      className="survey-data-status-banner"
    >
      {USE_MOCK_READS
        ? "Demo data mode. Responses are stored only in this browser session."
        : "Survey data is temporarily unavailable. Reconnecting…"}
    </HintBanner>
  );
}

export function DuplicateSurveyBanner() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return listenForDuplicateSurveyNotice(() => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setVisible(true);
      timerRef.current = window.setTimeout(() => {
        setVisible(false);
        timerRef.current = null;
      }, 5200);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <HintBanner
      visible={visible}
      className="duplicate-survey-banner"
    >
      <>
        You've already taken the survey.
        <br />
        Explore results button at top will let you in.
      </>
    </HintBanner>
  );
}

function rateLimitMessage(detail: RateLimitNoticeDetail) {
  const fallback = detail.message ?? "Too many submissions. Please wait a moment and try again.";
  if (!detail.resetAt) return fallback;

  const resetMs = Date.parse(detail.resetAt);
  if (!Number.isFinite(resetMs)) return fallback;

  const remainingMs = resetMs - Date.now();
  if (remainingMs <= 0) return fallback;

  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  if (remainingMinutes <= 90) {
    return `Too many submissions. Try again in about ${String(remainingMinutes)} min.`;
  }

  const resetTime = new Date(resetMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `Too many submissions. Try again after ${resetTime}.`;
}

export function RateLimitBanner() {
  const [topVisible, setTopVisible] = useState(false);
  const [bottomVisible, setBottomVisible] = useState(false);
  const [message, setMessage] = useState("Too many submissions. Please wait a moment and try again.");
  const topTimerRef = useRef<number | null>(null);
  const bottomTimerRef = useRef<number | null>(null);
  const hasShownPrimaryRef = useRef(false);

  useEffect(() => {
    return listenForRateLimitNotice((detail) => {
      const showPrimary = !hasShownPrimaryRef.current;
      if (topTimerRef.current) window.clearTimeout(topTimerRef.current);
      if (bottomTimerRef.current) window.clearTimeout(bottomTimerRef.current);

      setMessage(rateLimitMessage(detail));

      if (showPrimary) {
        hasShownPrimaryRef.current = true;
        setBottomVisible(false);
        setTopVisible(true);
        topTimerRef.current = window.setTimeout(() => {
          setTopVisible(false);
          topTimerRef.current = null;
        }, 7000);
        return;
      }

      setTopVisible(false);
      setBottomVisible(true);
      bottomTimerRef.current = window.setTimeout(() => {
        setBottomVisible(false);
        bottomTimerRef.current = null;
      }, 5200);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (topTimerRef.current) window.clearTimeout(topTimerRef.current);
      if (bottomTimerRef.current) window.clearTimeout(bottomTimerRef.current);
    };
  }, []);

  return (
    <>
      <HintBanner
        visible={topVisible}
        className="rate-limit-banner"
        closeLabel="Dismiss rate limit notice"
        onDismiss={() => {
          if (topTimerRef.current) {
            window.clearTimeout(topTimerRef.current);
            topTimerRef.current = null;
          }
          setTopVisible(false);
        }}
      >
        {message}
      </HintBanner>
      <HintBanner
        visible={bottomVisible}
        className="rate-limit-retry-banner"
      >
        {message}
      </HintBanner>
    </>
  );
}
