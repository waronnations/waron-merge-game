// src/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "@/lib/monitoring";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    captureException(error, {
      source: "react_error_boundary",
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-red-500">
            Critical Failure
          </p>
          <h1 className="mt-3 text-xl font-bold uppercase tracking-widest text-zinc-100">
            Something went wrong on the battlefield
          </h1>
          <p className="mt-3 max-w-sm text-sm text-zinc-400">
            The frontlines hit an unexpected error. Reload to rejoin the fight — your
            progress is saved on the server.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-red-500 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-black transition-colors hover:bg-red-400"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded-md border border-zinc-700 px-5 py-2 text-sm font-semibold uppercase tracking-widest text-zinc-300 transition-colors hover:border-red-500 hover:text-red-400"
            >
              Back to base
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
