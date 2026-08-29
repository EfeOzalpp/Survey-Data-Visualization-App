// src/lib/utils/scheduleIdle.ts
// Generic "run this during idle time" primitive: requestIdleCallback when
// available, a setTimeout fallback otherwise. Returns a cancel function.

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: Window["setTimeout"];
  clearTimeout: Window["clearTimeout"];
}

export function scheduleIdle(callback: () => void, timeout = 1500) {
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
