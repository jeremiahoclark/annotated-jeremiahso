import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
          <p className="metrics-font text-xs uppercase tracking-widest text-error">
            Something went wrong
          </p>
          <h1 className="news-title mt-3 text-3xl font-bold text-on-surface">
            We hit a snag
          </h1>
          <p className="mt-2 max-w-md text-sm text-on-surface-variant">
            Try refreshing the page, or head back home.
          </p>
          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="rounded-xl border border-outline-variant/40 px-5 py-2.5 text-sm font-medium text-on-surface transition-colors hover:border-primary-container/40"
            >
              Reload
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ hasError: false })}
              className="rounded-xl bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary"
            >
              Back home
            </Link>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
