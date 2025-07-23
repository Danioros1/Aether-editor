// React hook for performance optimization
import { useState, useEffect, useCallback } from 'react';
import { 
  performanceOptimizer, 
  PerformanceMode, 
  OptimizationSuggestion,
  PerformanceOptimizationConfig 
} from '../utils/performanceOptimizer';

export interface UsePerformanceOptimizerReturn {
  // Current state
  currentMode: PerformanceMode;
  isAutoOptimizationEnabled: boolean;
  suggestions: OptimizationSuggestion[];
  performanceStatus: {
    mode: PerformanceMode;
    healthy: boolean;
    issues: string[];
    suggestions: number;
  };
  
  // Actions
  setPerformanceMode: (mode: PerformanceMode) => void;
  toggleAutoOptimization: () => void;
  resetToNormal: () => void;
  analyzeNow: () => void;
  updateConfig: (config: Partial<PerformanceOptimizationConfig>) => void;
  
  // Configuration
  config: PerformanceOptimizationConfig;
  optimizationHistory: Array<{
    timestamp: Date;
    mode: PerformanceMode;
    reason: string;
    metrics: any;
  }>;
}

export const usePerformanceOptimizer = (): UsePerformanceOptimizerReturn => {
  const [currentMode, setCurrentMode] = useState<PerformanceMode>(
    performanceOptimizer.getCurrentMode()
  );
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
  const [config, setConfig] = useState<PerformanceOptimizationConfig>(
    performanceOptimizer.getConfig()
  );
  const [optimizationHistory, setOptimizationHistory] = useState(
    performanceOptimizer.getOptimizationHistory()
  );
  const [performanceStatus, setPerformanceStatus] = useState(
    performanceOptimizer.getPerformanceStatus()
  );

  // Update performance status periodically
  useEffect(() => {
    const updateStatus = () => {
      setPerformanceStatus(performanceOptimizer.getPerformanceStatus());
      setOptimizationHistory(performanceOptimizer.getOptimizationHistory());
    };

    const interval = setInterval(updateStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  // Listen for mode changes
  useEffect(() => {
    const handleModeChange = (mode: PerformanceMode, reason: string) => {
      setCurrentMode(mode);
      setOptimizationHistory(performanceOptimizer.getOptimizationHistory());
      console.log(`Performance mode changed to ${mode}: ${reason}`);
    };

    performanceOptimizer.addModeChangeListener(handleModeChange);
    return () => performanceOptimizer.removeModeChangeListener(handleModeChange);
  }, []);

  // Listen for suggestions
  useEffect(() => {
    const handleSuggestions = (newSuggestions: OptimizationSuggestion[]) => {
      setSuggestions(newSuggestions);
    };

    performanceOptimizer.addSuggestionListener(handleSuggestions);
    return () => performanceOptimizer.removeSuggestionListener(handleSuggestions);
  }, []);

  // Set performance mode manually
  const setPerformanceModeManual = useCallback((mode: PerformanceMode) => {
    performanceOptimizer.setPerformanceMode(mode, 'Manual');
  }, []);

  // Toggle auto-optimization
  const toggleAutoOptimization = useCallback(() => {
    const newEnabled = !config.autoOptimization.enabled;
    const newConfig = {
      ...config,
      autoOptimization: {
        ...config.autoOptimization,
        enabled: newEnabled
      }
    };
    
    performanceOptimizer.updateConfig(newConfig);
    performanceOptimizer.setAutoOptimization(newEnabled);
    setConfig(newConfig);
  }, [config]);

  // Reset to normal mode
  const resetToNormal = useCallback(() => {
    performanceOptimizer.resetToNormal();
  }, []);

  // Analyze performance now
  const analyzeNow = useCallback(() => {
    performanceOptimizer.analyzeNow();
  }, []);

  // Update configuration
  const updateConfig = useCallback((newConfig: Partial<PerformanceOptimizationConfig>) => {
    const updatedConfig = { ...config, ...newConfig };
    performanceOptimizer.updateConfig(updatedConfig);
    setConfig(updatedConfig);
  }, [config]);

  return {
    // Current state
    currentMode,
    isAutoOptimizationEnabled: config.autoOptimization.enabled,
    suggestions,
    performanceStatus,
    
    // Actions
    setPerformanceMode: setPerformanceModeManual,
    toggleAutoOptimization,
    resetToNormal,
    analyzeNow,
    updateConfig,
    
    // Configuration
    config,
    optimizationHistory,
  };
};

// Hook for components that need to respond to performance mode changes
export const usePerformanceMode = () => {
  const [mode, setMode] = useState<PerformanceMode>(
    performanceOptimizer.getCurrentMode()
  );

  useEffect(() => {
    const handleModeChange = (newMode: PerformanceMode) => {
      setMode(newMode);
    };

    performanceOptimizer.addModeChangeListener(handleModeChange);
    return () => performanceOptimizer.removeModeChangeListener(handleModeChange);
  }, []);

  return mode;
};

// Hook for getting performance-aware component props
export const usePerformanceProps = () => {
  const mode = usePerformanceMode();

  return {
    mode,
    isOptimized: mode !== 'normal',
    isMinimal: mode === 'minimal',
    shouldReduceQuality: mode === 'optimized' || mode === 'minimal',
    shouldDisableAnimations: mode === 'minimal',
    shouldReduceEffects: mode === 'optimized' || mode === 'minimal',
    shouldLimitRendering: mode === 'minimal',
  };
};