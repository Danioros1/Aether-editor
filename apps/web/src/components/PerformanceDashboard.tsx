// Performance monitoring dashboard component
import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  MemoryStick, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Settings, 
  RefreshCw,
  Clock,
  BarChart3,
  PieChart,
  Monitor
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { usePerformanceOptimizer } from '../hooks/usePerformanceOptimizer';
import { useMemoryManager } from '../hooks/useMemoryManager';
import { performanceMonitor } from '../utils/performanceMonitor';

interface PerformanceDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const {
    currentMode,
    isAutoOptimizationEnabled,
    suggestions,
    performanceStatus,
    toggleAutoOptimization,
    setPerformanceMode,
    resetToNormal,
    analyzeNow,
    optimizationHistory
  } = usePerformanceOptimizer();

  const {
    memoryReport,
    memoryHistory,
    performCleanup,
    memoryStats
  } = useMemoryManager();

  const [currentMetrics, setCurrentMetrics] = useState(performanceMonitor.getMetrics());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update metrics periodically
  useEffect(() => {
    if (!isOpen) return;

    const updateMetrics = () => {
      setCurrentMetrics(performanceMonitor.getMetrics());
    };

    const interval = setInterval(updateMetrics, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Handle manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    analyzeNow();
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay for UX
    setIsRefreshing(false);
  };

  // Handle cleanup
  const handleCleanup = async (aggressive: boolean = false) => {
    try {
      const result = await performCleanup(aggressive);
      console.log('Cleanup result:', result);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  };

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'critical': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'normal': return 'bg-green-100 text-green-800';
      case 'optimized': return 'bg-yellow-100 text-yellow-800';
      case 'minimal': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <Activity className="w-6 h-6 text-blue-500" />
            <h2 className="text-xl font-semibold">Performance Dashboard</h2>
            <Badge className={getModeColor(currentMode)}>
              {currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto h-full">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="memory">Memory</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Performance Status */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Monitor className="w-4 h-4 mr-2" />
                      System Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${getStatusColor(performanceStatus.mode)}`}>
                      {performanceStatus.healthy ? 'Healthy' : 'Issues Detected'}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {performanceStatus.issues.length} active issues
                    </div>
                    {performanceStatus.issues.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {performanceStatus.issues.slice(0, 3).map((issue, index) => (
                          <div key={index} className="text-xs text-red-600 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {issue}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Memory Usage */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <MemoryStick className="w-4 h-4 mr-2" />
                      Memory Usage
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {memoryReport ? Math.round(memoryReport.usedMemory) : 0}MB
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      of {memoryReport ? Math.round(memoryReport.totalMemory) : 0}MB available
                    </div>
                    {memoryReport && (
                      <div className="mt-3">
                        <Progress 
                          value={(memoryReport.usedMemory / memoryReport.totalMemory) * 100} 
                          className="h-2"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>0MB</span>
                          <span>{Math.round(memoryReport.totalMemory)}MB</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Frame Rate */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Zap className="w-4 h-4 mr-2" />
                      Frame Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {Math.round(currentMetrics.renderingMetrics.frameRate)}fps
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Avg: {currentMetrics.renderingMetrics.averageFrameTime.toFixed(1)}ms
                    </div>
                    <div className="mt-3 flex items-center">
                      {currentMetrics.renderingMetrics.frameRate >= 30 ? (
                        <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                      )}
                      <span className="text-xs text-gray-500">
                        {currentMetrics.renderingMetrics.droppedFrames} dropped frames
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Component Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Component Render Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(currentMetrics.componentMetrics).map(([component, time]) => (
                      <div key={component} className="flex items-center justify-between">
                        <span className="text-sm capitalize">
                          {component.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono">{time.toFixed(1)}ms</span>
                          <div className="w-20 h-2 bg-gray-200 rounded">
                            <div 
                              className={`h-full rounded ${
                                time > 100 ? 'bg-red-500' : 
                                time > 50 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min((time / 100) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Optimizations */}
              {optimizationHistory.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      Recent Optimizations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {optimizationHistory.slice(-5).reverse().map((entry, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={getModeColor(entry.mode)}>
                              {entry.mode}
                            </Badge>
                            <span>{entry.reason}</span>
                          </div>
                          <span className="text-gray-500">
                            {entry.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Memory Tab */}
            <TabsContent value="memory" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Memory Breakdown */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center">
                      <PieChart className="w-4 h-4 mr-2" />
                      Memory Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {memoryReport && (
                      <div className="space-y-3">
                        {Object.entries(memoryReport.breakdown).map(([category, size]) => (
                          <div key={category} className="flex items-center justify-between">
                            <span className="text-sm capitalize">{category}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-mono">{size.toFixed(1)}MB</span>
                              <div className="w-16 h-2 bg-gray-200 rounded">
                                <div 
                                  className="h-full bg-blue-500 rounded"
                                  style={{ 
                                    width: `${Math.min((size / memoryReport.totalMemory) * 100 * 10, 100)}%` 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Memory Categories */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Category Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {memoryStats.categoryStats.map((stat) => (
                        <div key={stat.category} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="capitalize">{stat.category}</span>
                            <span>{stat.itemCount} items</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{stat.currentSize.toFixed(1)}MB / {stat.maxSize}MB</span>
                            <span>{stat.utilizationPercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={stat.utilizationPercent} className="h-1" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Memory Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Memory Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={() => handleCleanup(false)}
                      className="flex items-center"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Standard Cleanup
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleCleanup(true)}
                      className="flex items-center text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Aggressive Cleanup
                    </Button>
                  </div>
                  {memoryReport && memoryReport.recommendations.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Recommendations:</h4>
                      <ul className="text-sm text-blue-700 space-y-1">
                        {memoryReport.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance Tab */}
            <TabsContent value="performance" className="space-y-6">
              {/* Performance Mode Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Performance Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex space-x-3 mb-4">
                    <Button
                      variant={currentMode === 'normal' ? 'default' : 'outline'}
                      onClick={() => setPerformanceMode('normal')}
                      size="sm"
                    >
                      Normal
                    </Button>
                    <Button
                      variant={currentMode === 'optimized' ? 'default' : 'outline'}
                      onClick={() => setPerformanceMode('optimized')}
                      size="sm"
                    >
                      Optimized
                    </Button>
                    <Button
                      variant={currentMode === 'minimal' ? 'default' : 'outline'}
                      onClick={() => setPerformanceMode('minimal')}
                      size="sm"
                    >
                      Minimal
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetToNormal}
                      size="sm"
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="text-sm text-gray-600">
                    Current mode: <strong>{currentMode}</strong>
                    {currentMode !== 'normal' && (
                      <span className="ml-2 text-blue-600">
                        (Performance optimizations active)
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Performance History Chart Placeholder */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Performance History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Performance history chart would be displayed here</p>
                      <p className="text-xs mt-1">
                        Showing frame rate, memory usage, and render times over time
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Suggestions Tab */}
            <TabsContent value="suggestions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    Performance Suggestions ({suggestions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {suggestions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No performance suggestions at this time</p>
                      <p className="text-xs mt-1">Your system is running optimally</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {suggestions.map((suggestion) => (
                        <div 
                          key={suggestion.id} 
                          className={`p-4 rounded-lg border ${
                            suggestion.severity === 'critical' 
                              ? 'border-red-200 bg-red-50' 
                              : 'border-yellow-200 bg-yellow-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <AlertTriangle className={`w-4 h-4 ${
                                  suggestion.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'
                                }`} />
                                <h4 className="font-medium">{suggestion.title}</h4>
                                <Badge variant="outline" className={
                                  suggestion.severity === 'critical' 
                                    ? 'border-red-300 text-red-700' 
                                    : 'border-yellow-300 text-yellow-700'
                                }>
                                  {suggestion.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">
                                {suggestion.description}
                              </p>
                              <p className="text-sm font-medium">
                                Action: {suggestion.action}
                              </p>
                            </div>
                            {suggestion.autoApplicable && !suggestion.applied && (
                              <Button size="sm" variant="outline">
                                Apply
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center">
                    <Settings className="w-4 h-4 mr-2" />
                    Auto-Optimization Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="auto-optimization">Enable Auto-Optimization</Label>
                      <p className="text-sm text-gray-500">
                        Automatically switch performance modes based on system metrics
                      </p>
                    </div>
                    <Switch
                      id="auto-optimization"
                      checked={isAutoOptimizationEnabled}
                      onCheckedChange={toggleAutoOptimization}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};