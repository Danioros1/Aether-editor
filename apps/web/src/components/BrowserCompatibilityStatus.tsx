/**
 * Browser Compatibility Status Component
 * 
 * Displays browser compatibility information and warnings to users.
 * Shows which features are available, missing, or using fallbacks.
 */

import React from 'react';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { useBrowserCompatibility } from '@/hooks/useBrowserCompatibility';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

interface BrowserCompatibilityStatusProps {
  showInline?: boolean;
  showDetailedView?: boolean;
}

export function BrowserCompatibilityStatus({ 
  showInline = false, 
  showDetailedView = false 
}: BrowserCompatibilityStatusProps) {
  const {
    isInitialized,
    missingAPIs,
    criticalMissing,
    fallbacksApplied,
    compatibilityScore,
    refreshStatus
  } = useBrowserCompatibility();

  if (!isInitialized) {
    return null;
  }

  // Don't show anything if compatibility is perfect
  if (compatibilityScore === 100 && !showDetailedView) {
    return null;
  }

  const getCompatibilityLevel = () => {
    if (compatibilityScore >= 90) return 'excellent';
    if (compatibilityScore >= 75) return 'good';
    if (compatibilityScore >= 60) return 'fair';
    return 'poor';
  };

  const compatibilityLevel = getCompatibilityLevel();

  const getStatusIcon = () => {
    switch (compatibilityLevel) {
      case 'excellent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'good':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'fair':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'poor':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    switch (compatibilityLevel) {
      case 'excellent':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'good':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      case 'fair':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'poor':
        return 'text-red-700 bg-red-50 border-red-200';
    }
  };

  const InlineStatus = () => (
    <div className="flex items-center gap-2 text-sm">
      {getStatusIcon()}
      <span>Browser Compatibility: {compatibilityScore}%</span>
      {criticalMissing.length > 0 && (
        <Badge variant="destructive" className="text-xs">
          {criticalMissing.length} critical issues
        </Badge>
      )}
    </div>
  );

  const DetailedStatus = () => (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Compatibility Score</span>
          <span className="text-sm text-muted-foreground">{compatibilityScore}%</span>
        </div>
        <Progress value={compatibilityScore} className="h-2" />
      </div>

      {/* Critical Missing Features */}
      {criticalMissing.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-500" />
          <AlertTitle className="text-red-700">Critical Features Missing</AlertTitle>
          <AlertDescription className="text-red-600">
            The following critical features are not available in your browser:
            <ul className="mt-2 list-disc list-inside space-y-1">
              {criticalMissing.map(api => (
                <li key={api} className="text-sm">
                  <code className="bg-red-100 px-1 rounded text-xs">{api}</code>
                  {api === 'WebGL' && ' - Hardware acceleration unavailable'}
                  {api === 'AudioContext' && ' - Audio features disabled'}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Fallbacks Applied */}
      {fallbacksApplied.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="text-yellow-700">Fallbacks Active</AlertTitle>
          <AlertDescription className="text-yellow-600">
            The following features are using fallback implementations:
            <div className="mt-2 flex flex-wrap gap-1">
              {fallbacksApplied.map(api => (
                <Badge key={api} variant="outline" className="text-xs">
                  {api}
                </Badge>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Missing Non-Critical Features */}
      {missingAPIs.filter(api => !criticalMissing.includes(api)).length > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-700">Optional Features Unavailable</AlertTitle>
          <AlertDescription className="text-blue-600">
            Some optional features are not available but won't affect core functionality:
            <div className="mt-2 flex flex-wrap gap-1">
              {missingAPIs
                .filter(api => !criticalMissing.includes(api))
                .map(api => (
                  <Badge key={api} variant="secondary" className="text-xs">
                    {api}
                  </Badge>
                ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations */}
      {compatibilityScore < 90 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Recommendations</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {criticalMissing.includes('WebGL') && (
                <li>• Update your browser or enable hardware acceleration for better performance</li>
              )}
              {criticalMissing.includes('AudioContext') && (
                <li>• Use a modern browser to enable audio features</li>
              )}
              {missingAPIs.includes('IntersectionObserver') && (
                <li>• Update your browser for better scrolling performance</li>
              )}
              {compatibilityScore < 75 && (
                <li>• Consider updating to a modern browser for the best experience</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refreshStatus}>
          Refresh Status
        </Button>
      </div>
    </div>
  );

  if (showInline) {
    return <InlineStatus />;
  }

  if (showDetailedView) {
    return <DetailedStatus />;
  }

  // Default: Show as dialog trigger
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={`${getStatusColor()} border`}>
          {getStatusIcon()}
          <span className="ml-2">Compatibility: {compatibilityScore}%</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Browser Compatibility Status
          </DialogTitle>
          <DialogDescription>
            Information about browser feature availability and fallbacks.
          </DialogDescription>
        </DialogHeader>
        <DetailedStatus />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact compatibility indicator for status bars
 */
export function BrowserCompatibilityIndicator() {
  const { compatibilityScore, criticalMissing } = useBrowserCompatibility();

  if (compatibilityScore === 100) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
          {criticalMissing.length > 0 ? (
            <XCircle className="h-3 w-3 text-red-500 mr-1" />
          ) : (
            <AlertTriangle className="h-3 w-3 text-yellow-500 mr-1" />
          )}
          {compatibilityScore}%
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Browser Compatibility</DialogTitle>
          <DialogDescription>
            Your browser compatibility score and feature availability.
          </DialogDescription>
        </DialogHeader>
        <BrowserCompatibilityStatus showDetailedView />
      </DialogContent>
    </Dialog>
  );
}