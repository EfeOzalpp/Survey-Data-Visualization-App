import { createRoot, hydrateRoot } from 'react-dom/client';
import AppShell from './app-core/main';
import { initPostHog } from './lib/posthog';

interface IdleWindow {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
}

function scheduleStartupWork(callback: () => void, timeout = 2500) {
  const idleWindow = window as Window & IdleWindow;
  const runWhenIdle = () => {
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(callback, { timeout });
      return;
    }
    window.setTimeout(callback, timeout);
  };

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(runWhenIdle);
  });
}

const container = document.getElementById('butterfly-effect');
if (!container) {
  throw new Error('Missing #butterfly-effect root element');
}

// SSR sends HTML inside #butterfly-effect. When that markup exists,
// hydrate so React reuses the DOM instead of recreating it from an empty root.
if (container.hasChildNodes()) {
  hydrateRoot(container, <AppShell />, {
    // TEMP diagnostic for the #421 hunt: onRecoverableError gets the
    // component stack even when the console log alone doesn't show one.
    onRecoverableError: (error, errorInfo) => {
      console.error('[hydration] recoverable error:', error);
      console.error('[hydration] component stack:', errorInfo.componentStack);
    },
  });
} else {
  createRoot(container).render(<AppShell />);
}

scheduleStartupWork(() => {
  void import('./lib/sentry').then(({ initSentry }) => {
    initSentry();
  }).catch((error: unknown) => {
    console.warn('[sentry] init import failed:', error);
  });

  void initPostHog();
});
