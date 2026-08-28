import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";

import HintBanner from "../../../app-core/ui-generics/HintBanner";
import styles from "./hover-hint.module.css";

const HOVER_HINT_DELAY_MS = 700;

interface HintPosition {
  left: number;
  top: number;
}

interface HoverHintContextValue {
  schedule: (anchor: HTMLElement, copy: string) => void;
  hide: () => void;
}

type HintPlacement = "bottom" | "right";

const HoverHintContext = createContext<HoverHintContextValue | null>(null);

export function HoverHintProvider({
  containerRef,
  placement,
  children,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  placement: HintPlacement;
  children: ReactNode;
}) {
  const timerRef = useRef<number | null>(null);
  const [copy, setCopy] = useState("");
  const [position, setPosition] = useState<HintPosition>({ left: 0, top: 0 });
  const [visible, setVisible] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setVisible(false);
  }, [clearTimer]);

  const schedule = useCallback((anchor: HTMLElement, nextCopy: string) => {
    clearTimer();
    setVisible(false);

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      const container = containerRef.current;
      if (!container || !anchor.isConnected) return;

      const containerRect = container.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      setCopy(nextCopy);
      setPosition(placement === "bottom"
        ? {
            left: anchorRect.left - containerRect.left + anchorRect.width / 2,
            top: anchorRect.bottom - containerRect.top,
          }
        : {
            left: anchorRect.right - containerRect.left,
            top: anchorRect.top - containerRect.top + anchorRect.height / 2,
          });
      setVisible(true);
    }, HOVER_HINT_DELAY_MS);
  }, [clearTimer, containerRef, placement]);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [hide, visible]);

  const contextValue = useMemo<HoverHintContextValue>(() => ({ schedule, hide }), [hide, schedule]);

  return (
    <HoverHintContext.Provider value={contextValue}>
      {children}
      <div
        className={`${styles.positioner} ${placement === "bottom" ? styles.positionerBottom : styles.positionerRight}`}
        style={{ left: position.left, top: position.top }}
      >
        <HintBanner visible={visible} className={styles.banner}>{copy}</HintBanner>
      </div>
    </HoverHintContext.Provider>
  );
}

export function HoverHintTarget({
  copy,
  disabled = false,
  children,
}: {
  copy: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const context = useContext(HoverHintContext);
  if (!context) throw new Error("HoverHintTarget must be used within HoverHintProvider");

  useEffect(() => {
    if (disabled) context.hide();
  }, [context, disabled]);

  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || event.pointerType === "touch") return;
    context.schedule(event.currentTarget, copy);
  };

  return (
    <div
      className={styles.target}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={context.hide}
      onPointerDown={context.hide}
    >
      {children}
    </div>
  );
}
