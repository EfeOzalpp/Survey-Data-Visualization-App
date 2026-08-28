// graceful error handling for modules, so they don't break the whole app
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State { crashed: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.name ? ` "${this.props.name}"` : ""}] Uncaught error:`, error, info.componentStack);
    void import("../lib/sentry")
      .then(({ captureException }) => {
        captureException(error, {
          contexts: { react: { componentStack: info.componentStack ?? "" } },
          tags: { boundary: this.props.name ?? "unknown" },
        });
      })
      .catch((err: unknown) => {
        console.warn("[ErrorBoundary] Sentry capture failed:", err);
      });
  }

  render() {
    if (this.state.crashed) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
