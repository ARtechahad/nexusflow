import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught UI exception caught:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#070a12] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 font-sans">
          <div className="max-w-xl w-full bg-white dark:bg-[#0c1220] border border-slate-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-fadeIn">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-mono font-bold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Graceful Error Boundary Active</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Application Rendering Interrupted
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                An unexpected interface state occurred. Your offline database and persistent session data remain securely preserved.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left p-3.5 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 overflow-x-auto max-h-36">
                <p className="font-bold text-red-500">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="mt-1 opacity-70 whitespace-pre-wrap">{this.state.error.stack.split('\n').slice(0, 4).join('\n')}</pre>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Recover Interface</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-white/10 transition cursor-pointer"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Reload App</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
