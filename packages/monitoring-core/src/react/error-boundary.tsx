"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "../api.js";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered when an error has been caught. */
  fallback: ReactNode;
  /** Identifier sent to monitoring (e.g. "checkout-page"). */
  context: string;
  /** Optional callback invoked alongside captureException. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Generic React Error Boundary that reports to the configured monitoring
 * provider via `captureException`. The fallback UI is fully consumer-owned.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    captureException(error, {
      componentStack: errorInfo.componentStack,
      context: this.props.context,
    });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}
