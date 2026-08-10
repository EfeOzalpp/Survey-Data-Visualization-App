import { useEffect, type RefObject } from "react";
import { VIEWPORT_BREAKPOINTS } from "../responsive/breakpoints";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface FocusTrapOptions {
  enabled: boolean;
  containerRef: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  focusOnOpen?: boolean;
  focusContainerOnTouch?: boolean;
}

export function useFocusTrap({
  enabled,
  containerRef,
  returnFocusRef,
  focusOnOpen = true,
  focusContainerOnTouch = false,
}: FocusTrapOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const container = containerRef.current;
    if (!container) return;

    const returnTo =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const getFocusable = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

    if (focusOnOpen) {
      const compactTouchViewport = window.matchMedia(
        `(max-width: ${String(VIEWPORT_BREAKPOINTS.tabletMax)}px) and (any-pointer: coarse)`
      ).matches;
      const openedFromKeyboard = returnTo?.matches(":focus-visible") ?? false;

      if (focusContainerOnTouch && compactTouchViewport && !openedFromKeyboard) {
        container.focus({ preventScroll: true });
      } else {
        getFocusable()[0]?.focus();
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      const focusable = getFocusable();
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnTo?.focus();
    };
  }, [containerRef, enabled, focusContainerOnTouch, focusOnOpen, returnFocusRef]);
}
