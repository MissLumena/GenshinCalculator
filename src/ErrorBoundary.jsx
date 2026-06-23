import { Component } from 'react';
import { captureAppError } from './sentry';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error, info);
    captureAppError(error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: '2rem',
          background: '#0c1228',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}
        >
          <h1 style={{ color: '#fff', marginBottom: '1rem' }}>Ошибка приложения</h1>
          <pre style={{
            whiteSpace: 'pre-wrap',
            background: 'rgba(255,255,255,0.08)',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '14px',
          }}
          >
            {error?.message || String(error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '999px',
              border: 'none',
              background: '#e8c547',
              color: '#1a1a2e',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
