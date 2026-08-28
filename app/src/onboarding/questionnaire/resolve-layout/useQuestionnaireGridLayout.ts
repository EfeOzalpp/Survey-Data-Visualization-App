import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useUiStore } from "../../../app-core/state/ui-store";

import { CANVAS_PADDING, resolvePaddingSpec } from "../../../scene-canvas/scene-rules/canvas-padding";
import {
  deviceType,
  getViewportSize,
} from "../../../scene-canvas/shared/responsiveness";
import {
  justifyContentForUiPlacement,
  makeCenteredSquareGrid,
  resolveUiGridPlacement,
  type CellSize,
  type UiGridPlacementInput,
  uiGridPlacementToPx,
  usedRowsFromSpec,
} from "../../../scene-canvas/grid-layout";

interface CanvasBox {
  width: number;
  height: number;
}

function findActiveGridHost(
  preferCityCanvas: boolean,
  preferQuestionnaireHost: boolean
): HTMLElement | null {
  if (typeof document === "undefined") return null;

  if (preferCityCanvas) {
    const cityHost = document.getElementById("city-canvas-root");
    if (cityHost instanceof HTMLElement) return cityHost;
  }

  const questionnaireCanvas = document.getElementById("questionnaire-canvas-root");
  const questionnaireHost = document.querySelector(".onboarding-canvas.questionnaire-active");
  const canvasRoot = document.getElementById("canvas-root");

  const onboardingHost = preferQuestionnaireHost
    ? questionnaireCanvas ?? questionnaireHost ?? canvasRoot ?? document.querySelector(".onboarding-canvas")
    : canvasRoot ?? questionnaireHost ?? document.querySelector(".onboarding-canvas");

  return onboardingHost instanceof HTMLElement ? onboardingHost : null;
}

function readCanvasBox(host: HTMLElement | null): CanvasBox | null {
  if (!(host instanceof HTMLElement)) return null;

  const rect = host.getBoundingClientRect();
  const next = {
    width: Math.floor(rect.width > 0 ? rect.width : host.clientWidth),
    height: Math.floor(rect.height > 0 ? rect.height : host.clientHeight),
  };

  if (next.width <= 0 || next.height <= 0) return null;
  return next;
}

function readViewportBox(): CanvasBox | null {
  if (typeof window === "undefined") return null;

  const vv = window.visualViewport;
  const width = Math.floor(vv?.width ?? getViewportSize().w);
  const height = Math.floor(vv?.height ?? getViewportSize().h);

  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

export function useQuestionnaireGridLayout() {
  const cityPanelOpen = useUiStore((s) => s.cityPanelOpen);
  const questionnaireOpen = useUiStore((s) => s.questionnaireOpen);
  const preferCityCanvas = cityPanelOpen && questionnaireOpen;
  const preferQuestionnaireHost = questionnaireOpen && !preferCityCanvas;
  const [canvasBox, setCanvasBox] = useState<CanvasBox | null>(() =>
    readCanvasBox(findActiveGridHost(preferCityCanvas, preferQuestionnaireHost))
  );

  useEffect(() => {
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let observedHost: HTMLElement | null = null;
    const visualViewport = typeof window !== "undefined" ? window.visualViewport : undefined;

    const syncObserverTarget = (host: HTMLElement | null) => {
      if (observedHost === host) return;
      resizeObserver?.disconnect();
      observedHost = host;
      if (host && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => { scheduleMeasure(); });
        resizeObserver.observe(host);
      }
    };

    const measure = () => {
      const host = findActiveGridHost(preferCityCanvas, preferQuestionnaireHost);
      syncObserverTarget(host);

      const nextBox = preferQuestionnaireHost
        ? readViewportBox()
        : readCanvasBox(host);
      setCanvasBox(nextBox);
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    scheduleMeasure();
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    if (visualViewport) visualViewport.addEventListener("resize", scheduleMeasure);
    if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
      mutationObserver = new MutationObserver(() => { scheduleMeasure(); });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      if (visualViewport) visualViewport.removeEventListener("resize", scheduleMeasure);
    };
  }, [preferCityCanvas, preferQuestionnaireHost]);

  const layout = useMemo(() => {
    if (!canvasBox) return null;

    const spec = resolvePaddingSpec(canvasBox.width, CANVAS_PADDING.questionnaire);
    const grid = makeCenteredSquareGrid({
      w: canvasBox.width,
      h: canvasBox.height,
      rows: spec.rows,
      useTopRatio: spec.useTopRatio ?? 1,
      horizonPos: spec.horizonPos,
    });

    const size: CellSize = {
      cellW: grid.cellW,
      cellH: grid.cellH,
      ox: grid.ox,
      oy: grid.oy,
      ...grid.metrics,
    };

    return {
      width: canvasBox.width,
      height: canvasBox.height,
      device: deviceType(canvasBox.width),
      rows: grid.rows,
      cols: grid.cols,
      usedRows: usedRowsFromSpec(grid.rows, spec.useTopRatio),
      spec,
      size,
      colsPerRow: grid.metrics.colsPerRow,
    };
  }, [canvasBox]);

  const getPlacementStyle = (
    placement: UiGridPlacementInput
  ): CSSProperties | undefined => {
    if (!layout) return undefined;

    const resolvedPlacement = resolveUiGridPlacement(
      {
        rows: layout.rows,
        cols: layout.cols,
        usedRows: layout.usedRows,
        colsPerRow: layout.colsPerRow,
      },
      placement
    );
    const px = uiGridPlacementToPx(layout.size, resolvedPlacement);
    return {
      left: `${String(px.left)}px`,
      top: `${String(px.anchorY)}px`,
      width: `${String(px.width)}px`,
      justifyContent: justifyContentForUiPlacement(placement),
    };
  };

  const resolvePlacement = useCallback(
    (placement: UiGridPlacementInput) => {
      if (!layout) return undefined;

      return resolveUiGridPlacement(
        {
          rows: layout.rows,
          cols: layout.cols,
          usedRows: layout.usedRows,
          colsPerRow: layout.colsPerRow,
        },
        placement
      );
    },
    [layout]
  );

  return {
    ready: !!layout,
    device: layout?.device ?? "laptop",
    layout,
    getPlacementStyle,
    resolvePlacement,
  };
}
