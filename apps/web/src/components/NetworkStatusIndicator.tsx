/**
 * Network Status Indicator Component
 * 
 * Displays network connectivity status and queued requests information.
 */

import React from 'react';
import { Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';
import { useNetworkErrorHandler } from '@/hooks/useNetworkErrorHandler';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface NetworkStatusIndicatorProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'icon' | 'badge' | 'full';
}

export function NetworkStatusIndicator({ 
  showLabel = false, 
  size = 'md',
  variant = 'icon'
}: NetworkStatusIndicatorProps) {
  const { isOnline, queuedRequestsCount } = useNetworkErrorHandler();

  const getIconSize = () => {
    switch (size) {
      case 'sm': return 'h-3 w-3';
      case 'md': return 'h-4 w-4';
      case 'lg': return 'h-5 w-5';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'text-red-500';
    if (queuedRequestsCount > 0) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (queuedRequestsCount > 0) return `Online (${queuedRequestsCount} queued)`;
    return 'Online';
  };

  const getTooltipContent = () => {
    if (!isOnline) {
      return 'You are currently offline. Requests will be queued until connection is restored.';
    }
    if (queuedRequestsCount > 0) {
      return `You are online. ${queuedRequestsCount} request${queuedRequestsCount === 1 ? '' : 's'} queued for processing.`;
    }
    return 'You are online and connected.';
  };

  const StatusIcon = () => (
    <div className={`${getStatusColor()} ${getIconSize()}`}>
      {isOnline ? <Wifi className={getIconSize()} /> : <WifiOff className={getIconSize()} />}
    </div>
  );

  const StatusBadge = () => (
    <Badge 
      variant={isOnline ? (queuedRequestsCount > 0 ? 'secondary' : 'default') : 'destructive'}
      className="flex items-center gap-1"
    >
      <StatusIcon />
      {showLabel && <span className="text-xs">{getStatusText()}</span>}
      {queuedRequestsCount > 0 && (
        <Badge variant="outline" className="ml-1 text-xs">
          {queuedRequestsCount}
        </Badge>
      )}
    </Badge>
  );

  const FullStatus = () => (
    <div className="flex items-center gap-2">
      <StatusIcon />
      <span className="text-sm font-medium">{getStatusText()}</span>
      {queuedRequestsCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {queuedRequestsCount}
        </Badge>
      )}
    </div>
  );

  const NetworkStatusDialog = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="p-1">
          {variant === 'badge' ? <StatusBadge /> : variant === 'full' ? <FullStatus /> : <StatusIcon />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StatusIcon />
            Network Status
          </DialogTitle>
          <DialogDescription>
            Current network connectivity and request queue status.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Connection Status */}
          <Alert className={isOnline ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-600" />
            )}
            <AlertTitle className={isOnline ? 'text-green-800' : 'text-red-800'}>
              {isOnline ? 'Connected' : 'Disconnected'}
            </AlertTitle>
            <AlertDescription className={isOnline ? 'text-green-700' : 'text-red-700'}>
              {isOnline 
                ? 'You have an active internet connection.'
                : 'No internet connection detected. Please check your network settings.'
              }
            </AlertDescription>
          </Alert>

          {/* Queued Requests */}
          {queuedRequestsCount > 0 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <Clock className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">
                Queued Requests
              </AlertTitle>
              <AlertDescription className="text-yellow-700">
                {queuedRequestsCount} request{queuedRequestsCount === 1 ? '' : 's'} waiting to be processed.
                {isOnline 
                  ? ' They will be processed automatically.'
                  : ' They will be processed when connection is restored.'
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Network Tips */}
          {!isOnline && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Troubleshooting Tips</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Check your WiFi or ethernet connection</li>
                  <li>• Try refreshing the page</li>
                  <li>• Check if other websites are accessible</li>
                  <li>• Contact your network administrator if the problem persists</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Quality Info */}
          {isOnline && (
            <div className="text-sm text-muted-foreground space-y-2">
              <div className="flex justify-between">
                <span>Connection Type:</span>
                <span>{(navigator as any).connection?.effectiveType || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span>Online Since:</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  // Simple tooltip wrapper for non-dialog variants
  const TooltipWrapper = ({ children }: { children: React.ReactNode }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  // Return appropriate variant
  switch (variant) {
    case 'badge':
      return (
        <TooltipWrapper>
          <StatusBadge />
        </TooltipWrapper>
      );
    case 'full':
      return <NetworkStatusDialog />;
    case 'icon':
    default:
      return (
        <TooltipWrapper>
          <StatusIcon />
        </TooltipWrapper>
      );
  }
}

/**
 * Compact network status for status bars
 */
export function NetworkStatusCompact() {
  const { isOnline, queuedRequestsCount } = useNetworkErrorHandler();

  if (isOnline && queuedRequestsCount === 0) {
    return null; // Don't show anything when everything is normal
  }

  return (
    <NetworkStatusIndicator 
      variant="full" 
      size="sm" 
    />
  );
}

/**
 * Network status banner for critical offline states
 */
export function NetworkStatusBanner() {
  const { isOnline, queuedRequestsCount } = useNetworkErrorHandler();

  if (isOnline) {
    return null;
  }

  return (
    <div className="bg-red-50 border-b border-red-200 px-4 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-red-600" />
          <span className="text-sm font-medium text-red-800">
            You're currently offline
          </span>
          {queuedRequestsCount > 0 && (
            <Badge variant="outline" className="text-xs border-red-300 text-red-700">
              {queuedRequestsCount} queued
            </Badge>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => window.location.reload()}
          className="text-red-700 border-red-300 hover:bg-red-100"
        >
          Retry Connection
        </Button>
      </div>
    </div>
  );
}