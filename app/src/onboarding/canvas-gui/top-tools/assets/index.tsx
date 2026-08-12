import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { usePreferences } from "../../../../app/state/preferences-context";
import ChevronIcon from "../../../../assets/svg/chevron/ChevronIcon";
import { HoverHintTarget } from "../../shared/hover-hint";
import { useEditorState, type AssetKey } from "../../state/editor-state-context";
import shared from "../top-tools.module.css";
import styles from "./assets.module.css";

const ASSETS = [
  { key: "house", label: "House" },
  { key: "carFactory", label: "Car Factory" },
  { key: "car", label: "Car" },
  { key: "bus", label: "Bus" },
  { key: "clouds", label: "Clouds" },
  { key: "power", label: "Power" },
  { key: "sea", label: "Sea" },
  { key: "snow", label: "Snow" },
  { key: "sun", label: "Sun" },
  { key: "trees", label: "Trees" },
  { key: "villa", label: "Villa" },
] as const satisfies readonly { key: AssetKey; label: string }[];

export default function Assets() {
  const { darkMode } = usePreferences();
  const { state, dispatch } = useEditorState();
  const [dragging, setDragging] = useState(false);
  const [scrollEdges, setScrollEdges] = useState({ left: false, right: true });
  const optionsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  });
  const suppressClickRef = useRef(false);

  const updateScrollEdges = useCallback(() => {
    const strip = optionsRef.current;
    if (!strip) return;

    const maxScrollLeft = Math.max(0, strip.scrollWidth - strip.clientWidth);
    const nextEdges = {
      left: strip.scrollLeft > 1,
      right: strip.scrollLeft < maxScrollLeft - 1,
    };

    setScrollEdges((current) => (
      current.left === nextEdges.left && current.right === nextEdges.right
        ? current
        : nextEdges
    ));
  }, []);

  useEffect(() => {
    const strip = optionsRef.current;
    if (!strip) return;

    let cancelled = false;
    const resizeObserver = new ResizeObserver(updateScrollEdges);
    resizeObserver.observe(strip);
    updateScrollEdges();

    void document.fonts.ready.then(() => {
      if (!cancelled) updateScrollEdges();
    });

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [darkMode, updateScrollEdges]);

  const scroll = (direction: -1 | 1) => {
    const strip = optionsRef.current;
    if (!strip) return;

    strip.scrollBy({
      left: direction * strip.clientWidth * 0.75,
      behavior: "smooth",
    });
  };

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    suppressClickRef.current = false;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    const distance = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(distance) < 4) return;

    if (!drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }

    event.preventDefault();
    event.currentTarget.scrollLeft = drag.startScrollLeft - distance;
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;

    suppressClickRef.current = drag.moved;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    drag.pointerId = -1;
    setDragging(false);
  };

  const cancelDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = -1;
    suppressClickRef.current = false;
    setDragging(false);
  };

  return (
    <div className={`${shared.group} ${styles.group}`}>
      <span className={shared.label}>Assets</span>
      <div className={styles.strip}>
        {scrollEdges.left && (
          <div className={`${styles.edge} ${styles.edgeStart}`}>
            <button
              type="button"
              className="ui-icon-nav-button"
              aria-label="Scroll assets left"
              onClick={() => { scroll(-1); }}
            >
              <ChevronIcon direction="previous" />
            </button>
          </div>
        )}
        <div
          ref={optionsRef}
          className={`${styles.options}${dragging ? ` ${styles.optionsDragging}` : ""}`}
          role="radiogroup"
          aria-label="Scene assets"
          onScroll={updateScrollEdges}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={cancelDrag}
          onClickCapture={(event) => {
            if (!suppressClickRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }}
        >
          {ASSETS.map((asset) => {
            const active = state.activeAsset === asset.key;
            const label = asset.key === "sun" && darkMode ? "Moon" : asset.label;

            return (
              <HoverHintTarget key={asset.key} copy={`${label} asset`}>
                <button
                  type="button"
                  role="radio"
                  className={`ui-toggle-option${active ? " is-active" : ""}`}
                  aria-checked={active}
                  onClick={() => { dispatch({ type: "set-asset", asset: asset.key }); }}
                >
                  {label}
                </button>
              </HoverHintTarget>
            );
          })}
        </div>
        {scrollEdges.right && (
          <div className={`${styles.edge} ${styles.edgeEnd}`}>
            <button
              type="button"
              className="ui-icon-nav-button"
              aria-label="Scroll assets right"
              onClick={() => { scroll(1); }}
            >
              <ChevronIcon direction="next" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
