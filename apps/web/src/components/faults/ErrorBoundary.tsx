'use client';

import * as Sentry from '@sentry/nextjs';
import { Component, type ErrorInfo, type ReactNode } from 'react';

// A scoped React error boundary for wrapping volatile in-call widgets
// (docs/adr/0018). A render crash inside `children` is caught here and replaced
// with a small inline fallback, so the crash never unmounts the call core or
// drops the participant from the call. Each volatile widget brings its own
// boundary; a crash in one panel must not take down its neighbours.
type Props = {
  children: ReactNode;
  // Inline fallback. A render prop gets a `reset` to retry mounting the subtree.
  fallback?: ReactNode | ((reset: () => void) => ReactNode);
  // What crashed, for the default fallback's copy ("Chat", "Host panel", …).
  label?: string;
  onError?: (error: Error) => void;
};

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    Sentry.withScope((scope) => {
      scope.setTag('error.boundary', 'scoped');
      if (this.props.label) scope.setTag('error.boundary.label', this.props.label);
      scope.setContext('react', { componentStack: info.componentStack });
      Sentry.captureException(error);
    });
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`, error);
    this.props.onError?.(error);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;

    const { fallback, label } = this.props;
    if (typeof fallback === 'function') return fallback(this.reset);
    if (fallback !== undefined) return fallback;

    return (
      <div role="alert" className="glass flex items-center justify-center gap-2 rounded-xl p-4 text-sm text-white/70">
        <span>{label ? `${label} crashed.` : 'This panel crashed.'}</span>
        <button
          type="button"
          onClick={this.reset}
          className="rounded-lg bg-white/8 px-2.5 py-1 text-xs text-white/80 ring-1 ring-white/10 transition-colors hover:bg-white/15"
        >
          Reload it
        </button>
      </div>
    );
  }
}
