import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message ?? 'Unknown UI error',
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Unhandled UI error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-xl border border-red-900/50 bg-red-950/20 p-6">
            <h1 className="text-xl font-semibold text-red-200 mb-2">Something went wrong</h1>
            <p className="text-sm text-red-100/90 mb-4">
              A rendering error occurred. Please reload the page.
            </p>
            <p className="text-xs text-red-300/80 break-all mb-6">{this.state.message}</p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 transition"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
