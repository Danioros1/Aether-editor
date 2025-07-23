/**
 * Error Reporting Dashboard Component
 * 
 * Displays error logs, statistics, and management controls for debugging.
 */

import React, { useState } from 'react';
import { AlertTriangle, Bug, CheckCircle, Download, Filter, Trash2, X } from 'lucide-react';
import { useErrorLogger } from '@/hooks/useErrorLogger';
import { ErrorReport, ErrorCategory, ErrorSeverity } from '@/utils/errorLogger';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ErrorReportingDashboardProps {
  showInline?: boolean;
}

export function ErrorReportingDashboard({ showInline = false }: ErrorReportingDashboardProps) {
  const {
    errors,
    errorStats,
    resolveError,
    clearErrors,
    clearResolvedErrors,
    exportErrors,
    getErrorsByCategory,
    getErrorsBySeverity,
    getCriticalErrors,
    getUnresolvedErrors,
    hasErrors,
    hasCriticalErrors,
    hasUnresolvedErrors
  } = useErrorLogger();

  const [selectedCategory, setSelectedCategory] = useState<ErrorCategory | 'all'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorSeverity | 'all'>('all');
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);

  // Filter errors based on selected criteria
  const filteredErrors = React.useMemo(() => {
    let filtered = errors;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(error => error.category === selectedCategory);
    }

    if (selectedSeverity !== 'all') {
      filtered = filtered.filter(error => error.severity === selectedSeverity);
    }

    return filtered;
  }, [errors, selectedCategory, selectedSeverity]);

  const getSeverityColor = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getCategoryIcon = (category: ErrorCategory) => {
    switch (category) {
      case 'api':
        return '🔌';
      case 'network':
        return '🌐';
      case 'ui':
        return '🎨';
      case 'performance':
        return '⚡';
      case 'storage':
        return '💾';
      case 'audio':
        return '🔊';
      case 'video':
        return '🎥';
      case 'browser':
        return '🌍';
      case 'user':
        return '👤';
      case 'system':
        return '⚙️';
      default:
        return '❓';
    }
  };

  const handleExportErrors = () => {
    const exportData = exportErrors();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ErrorStatsCard = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{errorStats.total}</p>
              <p className="text-xs text-muted-foreground">Total Errors</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <div>
              <p className="text-2xl font-bold text-red-600">{errorStats.bySeverity.critical || 0}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-orange-600">{errorStats.unresolved}</p>
              <p className="text-xs text-muted-foreground">Unresolved</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <div>
              <p className="text-2xl font-bold text-green-600">{errorStats.resolved}</p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const ErrorList = () => (
    <div className="space-y-2">
      {filteredErrors.map((error) => (
        <Card key={error.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedError(error)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{getCategoryIcon(error.category)}</span>
                  <Badge className={getSeverityColor(error.severity)}>
                    {error.severity}
                  </Badge>
                  <Badge variant="outline">{error.category}</Badge>
                  {error.count > 1 && (
                    <Badge variant="secondary">{error.count}x</Badge>
                  )}
                  {error.resolved && (
                    <Badge className="bg-green-100 text-green-800">Resolved</Badge>
                  )}
                </div>
                <p className="font-medium truncate">{error.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>First: {new Date(error.firstOccurred).toLocaleString()}</span>
                  <span>Last: {new Date(error.lastOccurred).toLocaleString()}</span>
                  {error.tags.length > 0 && (
                    <span>Tags: {error.tags.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {!error.resolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      resolveError(error.id);
                    }}
                  >
                    <CheckCircle className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {filteredErrors.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Bug className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No errors found matching the current filters.</p>
        </div>
      )}
    </div>
  );

  const ErrorDetailDialog = () => (
    <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">{selectedError && getCategoryIcon(selectedError.category)}</span>
            Error Details
          </DialogTitle>
          <DialogDescription>
            Detailed information about the error occurrence.
          </DialogDescription>
        </DialogHeader>
        
        {selectedError && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {/* Error Summary */}
              <div>
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge className={getSeverityColor(selectedError.severity)}>
                    {selectedError.severity}
                  </Badge>
                  <Badge variant="outline">{selectedError.category}</Badge>
                  {selectedError.count > 1 && (
                    <Badge variant="secondary">{selectedError.count} occurrences</Badge>
                  )}
                </div>
                <p className="text-sm bg-muted p-3 rounded">{selectedError.message}</p>
              </div>

              {/* Stack Trace */}
              {selectedError.stack && (
                <div>
                  <h4 className="font-medium mb-2">Stack Trace</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto whitespace-pre-wrap">
                    {selectedError.stack}
                  </pre>
                </div>
              )}

              {/* Context Information */}
              <div>
                <h4 className="font-medium mb-2">Context</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Session:</strong> {selectedError.context.sessionId}</p>
                    <p><strong>URL:</strong> {selectedError.context.url}</p>
                    <p><strong>Viewport:</strong> {selectedError.context.viewport.width}x{selectedError.context.viewport.height}</p>
                    <p><strong>First Occurred:</strong> {new Date(selectedError.firstOccurred).toLocaleString()}</p>
                    <p><strong>Last Occurred:</strong> {new Date(selectedError.lastOccurred).toLocaleString()}</p>
                  </div>
                  <div>
                    {selectedError.context.memoryUsage && (
                      <>
                        <p><strong>Memory Used:</strong> {(selectedError.context.memoryUsage.used / 1024 / 1024).toFixed(1)} MB</p>
                        <p><strong>Memory Total:</strong> {(selectedError.context.memoryUsage.total / 1024 / 1024).toFixed(1)} MB</p>
                      </>
                    )}
                    {selectedError.tags.length > 0 && (
                      <p><strong>Tags:</strong> {selectedError.tags.join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Browser Features */}
              {selectedError.context.browserFeatures && (
                <div>
                  <h4 className="font-medium mb-2">Browser Features</h4>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(selectedError.context.browserFeatures).map(([feature, supported]) => (
                      <div key={feature} className="flex items-center gap-1">
                        <span className={supported ? 'text-green-600' : 'text-red-600'}>
                          {supported ? '✓' : '✗'}
                        </span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom Data */}
              {selectedError.context.customData && (
                <div>
                  <h4 className="font-medium mb-2">Custom Data</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(selectedError.context.customData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                {!selectedError.resolved && (
                  <Button
                    onClick={() => {
                      resolveError(selectedError.id);
                      setSelectedError(null);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark as Resolved
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedError(null)}>
                  Close
                </Button>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );

  if (!hasErrors && !showInline) {
    return null;
  }

  const DashboardContent = () => (
    <div className="space-y-6">
      <ErrorStatsCard />
      
      {/* Filters and Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ErrorCategory | 'all')}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="api">API</SelectItem>
              <SelectItem value="network">Network</SelectItem>
              <SelectItem value="ui">UI</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="storage">Storage</SelectItem>
              <SelectItem value="audio">Audio</SelectItem>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="browser">Browser</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedSeverity} onValueChange={(value) => setSelectedSeverity(value as ErrorSeverity | 'all')}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportErrors}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={clearResolvedErrors}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Clear Resolved
          </Button>
          <Button variant="destructive" size="sm" onClick={clearErrors}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All
          </Button>
        </div>
      </div>

      {/* Error List */}
      <ErrorList />
      
      {/* Error Detail Dialog */}
      <ErrorDetailDialog />
    </div>
  );

  if (showInline) {
    return <DashboardContent />;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={hasCriticalErrors ? 'border-red-500 text-red-600' : ''}>
          <Bug className="h-4 w-4 mr-2" />
          Errors ({errorStats.total})
          {hasCriticalErrors && <AlertTriangle className="h-3 w-3 ml-1 text-red-500" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Error Reporting Dashboard</DialogTitle>
          <DialogDescription>
            Monitor and manage application errors and issues.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh]">
          <DashboardContent />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact error indicator for status bars
 */
export function ErrorIndicator() {
  const { hasErrors, hasCriticalErrors, errorStats } = useErrorLogger();

  if (!hasErrors) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
          {hasCriticalErrors ? (
            <AlertTriangle className="h-3 w-3 text-red-500 mr-1" />
          ) : (
            <Bug className="h-3 w-3 text-yellow-500 mr-1" />
          )}
          {errorStats.total}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Error Reports</DialogTitle>
          <DialogDescription>
            Application error logs and diagnostics.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh]">
          <ErrorReportingDashboard showInline />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}