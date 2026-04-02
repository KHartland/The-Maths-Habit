import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught:', error, errorInfo);

    // Auto-recover from transient errors (like React Error #310 race condition).
    // If this is the first or second error, retry after a short delay — the
    // auth state will have settled by then and the re-render will succeed.
    if (this.state.retryCount < 2) {
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: prev.retryCount + 1,
        }));
      }, 500);
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= 2) {
      // Only show error screen after 2 failed auto-retries
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a1a',
          padding: '24px',
        }}>
          <div style={{
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            padding: '40px 24px',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>😵</div>
            <h2 style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold', marginBottom: '12px' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#aaa', marginBottom: '20px' }}>
              Don't worry — your progress is saved locally. Try refreshing the page.
            </p>
            <details style={{ textAlign: 'left', color: '#888', fontSize: '12px', marginBottom: '20px' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '8px' }}>Error details</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px' }}>
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #DC32A0, #B00053)',
                color: '#fff',
                border: 'none',
                borderRadius: '16px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
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
