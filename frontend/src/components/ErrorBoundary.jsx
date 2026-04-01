import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center glass bg-black/40 border border-white/10 rounded-3xl m-4">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Something went wrong</h2>
          <p className="text-gray-400 font-medium mb-8 max-w-md">
            The component crashed while rendering. This is usually due to missing data or a temporary glitch.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-[#CDFF00] text-black font-black uppercase tracking-widest text-xs rounded-xl hover:scale-105 transition-transform shadow-lg shadow-[#CDFF00]/20"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-8 p-4 bg-black/60 rounded-xl border border-white/5 text-left w-full overflow-auto max-h-40">
              <p className="text-red-400 font-mono text-[10px] whitespace-pre-wrap">
                {this.state.error?.toString()}
              </p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
