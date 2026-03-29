import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crash caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-void flex items-center justify-center p-4">
          <div className="glass-panel rounded-xl p-8 text-center max-w-md">
            <div className="text-4xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-secondary-text mb-6">
              Don&apos;t worry — your progress is saved locally. Try refreshing
              the page.
            </p>
            <details className="text-left text-xs text-red-400 mb-4 max-h-40 overflow-auto">
              <summary className="cursor-pointer text-secondary-text">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">{this.state.error?.toString()}</pre>
              <pre className="mt-1 whitespace-pre-wrap break-words">{this.state.errorInfo?.componentStack}</pre>
            </details>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="px-6 py-3 btn-gradient-violet text-white rounded-xl font-semibold"
            >
              Refresh App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
