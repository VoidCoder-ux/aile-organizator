/**
 * main.tsx — Uygulama Giriş Noktası
 * React 18 createRoot, StrictMode, global error boundary.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// ── Global Hata Yakalayıcı ─────────────────────────────────────────────────

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 text-center">
          <div className="space-y-4">
            <div className="text-5xl">⚠️</div>
            <h1 className="text-xl font-bold">Bir sorun oluştu</h1>
            <p className="text-muted-foreground text-sm max-w-sm">
              {this.state.error?.message ?? 'Beklenmedik bir hata meydana geldi.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-primary px-6 py-2 text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── React 18 Mount ─────────────────────────────────────────────────────────

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element #root bulunamadı');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
