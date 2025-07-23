import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { logReactError } from '@/utils/errorLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'feature';
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeouts: NodeJS.Timeout[] = [];

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
    errorId: '',
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorInfo: null,
      retryCount: 0,
      errorId,
      copied: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error using the centralized error logging system
    logReactError(error, { componentStack: errorInfo.componentStack || '' });

    // Enhanced error reporting (legacy support)
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      level: this.props.level || 'component',
      name: this.props.name || 'Unknown Component',
      errorId: this.state.errorId,
    };

    this.reportError(errorDetails);

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private reportError = (errorDetails: any) => {
    // Store error in localStorage for debugging
    try {
      const existingErrors = JSON.parse(localStorage.getItem('aether-errors') || '[]');
      existingErrors.push(errorDetails);
      // Keep only last 10 errors
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10);
      }
      localStorage.setItem('aether-errors', JSON.stringify(existingErrors));
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e);
    }

    // In a real app, you would send this to your error reporting service
    // Example: Sentry, LogRocket, Bugsnag, etc.
    if (import.meta.env.PROD) {
      // window.errorReportingService?.captureException(errorDetails);
    }
  };

  private handleRetry = () => {
    const newRetryCount = this.state.retryCount + 1;
    
    // Prevent infinite retry loops
    if (newRetryCount > 3) {
      console.warn('Maximum retry attempts reached. Suggesting page reload.');
      return;
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: newRetryCount,
    });

    // Add progressive delay for retries
    const delay = Math.min(1000 * Math.pow(2, newRetryCount - 1), 5000);
    const timeout = setTimeout(() => {
      // Clear any component state that might be causing issues
      if (this.props.level === 'component') {
        // Force a re-render after delay
        this.forceUpdate();
      }
    }, delay);
    
    this.retryTimeouts.push(timeout);
  };

  private handleReload = () => {
    // Clear any stored errors before reload
    try {
      localStorage.removeItem('aether-errors');
    } catch (e) {
      console.warn('Failed to clear errors from localStorage:', e);
    }
    window.location.reload();
  };

  private handleCopyError = async () => {
    const errorText = this.getErrorText();
    try {
      await navigator.clipboard.writeText(errorText);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (e) {
      console.warn('Failed to copy error to clipboard:', e);
    }
  };

  private getErrorText = () => {
    const { error, errorInfo, errorId } = this.state;
    return `Error ID: ${errorId}
Component: ${this.props.name || 'Unknown'}
Level: ${this.props.level || 'component'}
Message: ${error?.message || 'Unknown error'}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Stack Trace:
${error?.stack || 'No stack trace available'}

Component Stack:
${errorInfo?.componentStack || 'No component stack available'}`;
  };

  public componentWillUnmount() {
    // Clear any pending timeouts
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorId, retryCount, copied } = this.state;
      const isComponentLevel = this.props.level === 'component';
      const maxRetriesReached = retryCount >= 3;

      // Component-level error (smaller, inline error)
      if (isComponentLevel) {
        return (
          <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-destructive mb-1">
                  {this.props.name || 'Component'} Error
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {error?.message || 'An unexpected error occurred in this component.'}
                </p>
                <div className="flex gap-2">
                  {!maxRetriesReached && (
                    <Button 
                      onClick={this.handleRetry}
                      variant="outline"
                      size="sm"
                      disabled={retryCount > 0}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Retry'}
                    </Button>
                  )}
                  <Button 
                    onClick={this.handleCopyError}
                    variant="ghost"
                    size="sm"
                  >
                    {copied ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Error
                      </>
                    )}
                  </Button>
                </div>
                {maxRetriesReached && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Maximum retry attempts reached. Consider reloading the page.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      }

      // Page-level error (full screen error)
      return (
        <div 
          className="min-h-screen bg-background flex items-center justify-center p-4"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-lg w-full space-y-6">
            <div className="text-center">
              <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Something went wrong
              </h1>
              <p className="text-muted-foreground">
                We encountered an unexpected error. This has been logged and we'll investigate.
              </p>
            </div>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium mb-1">Error ID: {errorId}</div>
                    <div className="text-sm font-mono bg-destructive/10 p-2 rounded">
                      {error?.message || 'Unknown error occurred'}
                    </div>
                  </div>
                  
                  {import.meta.env.DEV && this.state.errorInfo && (
                    <details className="text-xs">
                      <summary className="cursor-pointer font-medium hover:text-foreground">
                        Technical Details (Development Mode)
                      </summary>
                      <div className="mt-2 space-y-2">
                        <div>
                          <div className="font-medium">Stack Trace:</div>
                          <pre className="whitespace-pre-wrap bg-destructive/10 p-2 rounded overflow-auto max-h-32 text-xs">
                            {error?.stack}
                          </pre>
                        </div>
                        <div>
                          <div className="font-medium">Component Stack:</div>
                          <pre className="whitespace-pre-wrap bg-destructive/10 p-2 rounded overflow-auto max-h-32 text-xs">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <div className="flex gap-3">
                {!maxRetriesReached && (
                  <Button 
                    onClick={this.handleRetry}
                    variant="default"
                    className="flex-1"
                    disabled={retryCount > 0}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {retryCount > 0 ? `Retrying... (${retryCount}/3)` : 'Try Again'}
                  </Button>
                )}
                <Button 
                  onClick={this.handleReload}
                  variant="outline"
                  className="flex-1"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Reload App
                </Button>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  onClick={this.handleCopyError}
                  variant="ghost"
                  className="flex-1"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Error Details Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy Error Details
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => window.open('https://github.com/your-repo/issues', '_blank')}
                  variant="ghost"
                  className="flex-1"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Report Bug
                </Button>
              </div>
            </div>

            {maxRetriesReached && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Maximum retry attempts reached. The error may be persistent. 
                  Please try reloading the page or report this issue if it continues.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p>Error ID: <code className="bg-muted px-1 rounded">{errorId}</code></p>
              <p>If this problem persists, please include the error ID when contacting support.</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo, context?: string) => {
    // Use the centralized error logging system
    if (errorInfo) {
      logReactError(error, { componentStack: errorInfo.componentStack || '' });
    } else {
      // For non-React errors, use the general error logger
      const { errorLogger } = require('@/utils/errorLogger');
      errorLogger.logError({
        message: error.message,
        stack: error.stack,
        category: 'ui',
        severity: 'high',
        tags: ['hook', 'manual'],
        customData: { context: context || 'Unknown Context' }
      });
    }

    // Legacy error storage for backward compatibility
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      context: context || 'Unknown Context',
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    
    // Store error for debugging (legacy support)
    try {
      const existingErrors = JSON.parse(localStorage.getItem('aether-errors') || '[]');
      existingErrors.push(errorDetails);
      if (existingErrors.length > 10) {
        existingErrors.splice(0, existingErrors.length - 10);
      }
      localStorage.setItem('aether-errors', JSON.stringify(existingErrors));
    } catch (e) {
      console.warn('Failed to store error in localStorage:', e);
    }
  };
};

// Utility function to get stored errors for debugging
export const getStoredErrors = () => {
  try {
    return JSON.parse(localStorage.getItem('aether-errors') || '[]');
  } catch (e) {
    console.warn('Failed to retrieve stored errors:', e);
    return [];
  }
};

// Utility function to clear stored errors
export const clearStoredErrors = () => {
  try {
    localStorage.removeItem('aether-errors');
  } catch (e) {
    console.warn('Failed to clear stored errors:', e);
  }
};