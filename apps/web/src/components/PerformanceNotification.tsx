// Performance optimization notification component
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Zap, Settings, X, TrendingUp } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { PerformanceMode } from '../utils/performanceOptimizer';

interface PerformanceNotificationData {
  type: 'optimization' | 'warning' | 'suggestion';
  title: string;
  message: string;
  mode?: PerformanceMode;
  reason?: string;
  actions?: Array<{
    label: string;
    action: () => void;
  }>;
}

interface PerformanceNotificationProps {
  className?: string;
}

export const PerformanceNotification: React.FC<PerformanceNotificationProps> = ({ 
  className 
}) => {
  const [notification, setNotification] = useState<PerformanceNotificationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null);

  // Listen for performance notifications
  useEffect(() => {
    const handleNotification = (event: CustomEvent<PerformanceNotificationData>) => {
      const data = event.detail;
      setNotification(data);
      setIsVisible(true);

      // Auto-hide after 8 seconds for optimization notifications
      if (data.type === 'optimization') {
        const timer = setTimeout(() => {
          setIsVisible(false);
        }, 8000);
        setAutoHideTimer(timer);
      }
    };

    window.addEventListener('performance:notification', handleNotification as EventListener);
    return () => {
      window.removeEventListener('performance:notification', handleNotification as EventListener);
      if (autoHideTimer) {
        clearTimeout(autoHideTimer);
      }
    };
  }, [autoHideTimer]);

  // Handle manual close
  const handleClose = () => {
    setIsVisible(false);
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      setAutoHideTimer(null);
    }
  };

  // Handle notification hide animation end
  const handleAnimationEnd = () => {
    if (!isVisible) {
      setNotification(null);
    }
  };

  if (!notification) {
    return null;
  }

  const getIcon = () => {
    switch (notification.type) {
      case 'optimization':
        return <Zap className="w-5 h-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'suggestion':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      default:
        return <Settings className="w-5 h-5 text-gray-500" />;
    }
  };

  const getModeColor = (mode?: PerformanceMode) => {
    switch (mode) {
      case 'minimal':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'optimized':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'normal':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div 
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${className}`}
      onAnimationEnd={handleAnimationEnd}
      role="alert"
      aria-live="polite"
    >
      <Card className="w-80 shadow-lg border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              {getIcon()}
              <CardTitle className="text-sm font-medium">
                {notification.title}
              </CardTitle>
              {notification.mode && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getModeColor(notification.mode)}`}
                >
                  {notification.mode.charAt(0).toUpperCase() + notification.mode.slice(1)}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 hover:bg-gray-100"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          <p className="text-sm text-gray-600 mb-3">
            {notification.message}
          </p>
          
          {notification.reason && (
            <div className="text-xs text-gray-500 mb-3 p-2 bg-gray-50 rounded">
              <strong>Reason:</strong> {notification.reason}
            </div>
          )}
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={index === 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    action.action();
                    handleClose();
                  }}
                  className="text-xs"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Performance status indicator component
interface PerformanceStatusIndicatorProps {
  mode: PerformanceMode;
  healthy: boolean;
  issues: string[];
  className?: string;
}

export const PerformanceStatusIndicator: React.FC<PerformanceStatusIndicatorProps> = ({
  mode,
  healthy,
  issues,
  className
}) => {
  const getStatusColor = () => {
    if (!healthy) return 'text-red-500';
    switch (mode) {
      case 'minimal':
        return 'text-red-500';
      case 'optimized':
        return 'text-yellow-500';
      case 'normal':
        return 'text-green-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    if (!healthy) return <AlertTriangle className="w-4 h-4" />;
    switch (mode) {
      case 'minimal':
        return <AlertTriangle className="w-4 h-4" />;
      case 'optimized':
        return <Zap className="w-4 h-4" />;
      case 'normal':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <Settings className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (!healthy) return 'Performance Issues';
    switch (mode) {
      case 'minimal':
        return 'Minimal Mode';
      case 'optimized':
        return 'Optimized Mode';
      case 'normal':
        return 'Normal Mode';
      default:
        return 'Unknown';
    }
  };

  return (
    <div 
      className={`flex items-center space-x-2 ${getStatusColor()} ${className}`}
      title={issues.length > 0 ? issues.join(', ') : 'Performance is healthy'}
    >
      {getStatusIcon()}
      <span className="text-sm font-medium">
        {getStatusText()}
      </span>
      {issues.length > 0 && (
        <Badge variant="destructive" className="text-xs">
          {issues.length}
        </Badge>
      )}
    </div>
  );
};