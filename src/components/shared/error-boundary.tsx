"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Faultline ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-500/15 bg-[var(--fl-surface)] px-6 py-12">
          <div className="flex size-12 items-center justify-center rounded-2xl border border-red-500/15 bg-red-500/[0.06]">
            <AlertTriangle className="size-6 text-red-400" />
          </div>
          <div className="max-w-sm text-center">
            <p className="text-[14px] font-semibold text-[var(--fl-text-primary)]">
              Something went wrong
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[var(--fl-text-tertiary)]">
              {this.state.error?.message ?? "An unexpected error occurred while rendering this component."}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 rounded-lg border border-[var(--fl-border-active)] bg-[var(--fl-surface-raised)] px-4 py-2 text-[12px] font-medium text-[var(--fl-text-secondary)] transition-colors hover:bg-[var(--fl-surface)] hover:text-[var(--fl-text-primary)]"
          >
            <RefreshCw className="size-3.5" />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}