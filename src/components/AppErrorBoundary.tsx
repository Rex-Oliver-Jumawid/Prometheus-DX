import { Component, type ErrorInfo, type ReactNode } from 'react';

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

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled application error', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="grid min-h-screen place-items-center p-6">
          <section className="foundation-card max-w-lg text-center">
            <p className="eyebrow">Prometheus</p>
            <h1 className="mt-2 text-2xl font-semibold">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm text-[rgb(var(--text-muted))]">
              Reload the page. If the problem continues, inspect the browser
              console and API response.
            </p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
