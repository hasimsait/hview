import { Component,ErrorInfo,ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="absolute top-4 right-4 bg-red-950/90 border border-red-700 text-red-200 text-xs p-3 rounded-lg z-50">
            <p className="font-semibold">Inspector error occurred</p>
            <p className="text-[10px] text-red-400 mt-1">{this.state.error?.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
