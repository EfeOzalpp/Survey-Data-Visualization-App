// src/app-core/browser-policies.tsx
// Browser DOM policy management: zoom prevention, viewport overflow locking,
// and questionnaire scroll-lock, all tied to graph/questionnaire visibility.
import { useEffect } from "react";

import { usePreventPageZoomOutsideZones } from "../lib/hooks/usePreventPageZoom";
import { scheduleIdle } from "../lib/utils/scheduleIdle";

interface AppBrowserPoliciesProps {
  questionnaireOpen: boolean;
  vizVisible: boolean;
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
