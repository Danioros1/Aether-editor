
import React from 'react';
import './styles/enhanced-ui.css';
import { Timeline } from './components/Timeline';
import { AssetLibrary } from './components/AssetLibrary';
import { VirtualizedAssetLibrary } from './components/VirtualizedAssetLibrary';
import { OptimizedTimeline } from './components/OptimizedTimeline';
import { PropertyInspector } from './components/PropertyInspector';
import { PreviewWindow } from './components/PreviewWindow';
import { OptimizedPreviewWindow } from './components/OptimizedPreviewWindow';
import { TransportControls } from './components/TransportControls';
import { TimelineControls } from './components/TimelineControls';
import { ExportModal } from './components/ExportModal';
import { AiAssistantModal } from './components/AiAssistantModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ResponsiveLayout } from './components/ResponsiveLayout';
import { Toaster } from './components/Toaster';
import { TooltipProvider } from './components/ui/tooltip';
import { HelpTooltip, StatusTooltip } from './components/ui/enhanced-tooltip';
import { NotificationProvider, ToastContainer } from './components/ui/notification-system';
import { ScreenReaderOnly, SkipLink, LiveRegion } from './components/ui/accessibility';
import { ThemeProvider, ThemeToggle } from './components/ui/theme-provider';
import { HelpProvider, HelpCenter, HelpButton, QuickTip } from './components/ui/help-system';
import { PolishedCard, StatusIndicator, GlowEffect } from './components/ui/visual-polish';
import { FadeIn, GradientText } from './components/ui/animations';

import { usePlaybackEngine } from './hooks/usePlaybackEngine';
import { useAudioManager } from './hooks/useAudioManager';
import { useResponsive } from './hooks/useResponsive';
import { useAetherActions, useCurrentTime, useTimelineScale, useProjectSettings, useSelectedClipId, useSelectedClipIds, useUndoRedo, useAssetLibrary } from './store/useAetherStore';
import { initializePersistence } from './store/useAetherStore';
import { performanceMonitor } from './utils/performanceMonitor';
import { useToast } from './hooks/use-toast';
import { useBrowserCompatibility } from './hooks/useBrowserCompatibility';
import { BrowserCompatibilityIndicator } from './components/BrowserCompatibilityStatus';
import { NetworkStatusBanner, NetworkStatusCompact } from './components/NetworkStatusIndicator';
import { ErrorIndicator } from './components/ErrorReportingDashboard';
import { PerformanceNotification, PerformanceStatusIndicator } from './components/PerformanceNotification';
import { PerformanceDashboard } from './components/PerformanceDashboard';
import { usePerformanceOptimizer } from './hooks/usePerformanceOptimizer';
import { Zap, Film, AlertCircle, Activity } from 'lucide-react';
import { Badge } from './components/ui/badge';

function App() {
  // Initialize playback engine
  const { togglePlayPause, stop } = usePlaybackEngine();
  
  // Initialize audio manager (this will handle all audio synchronization)
  useAudioManager();
  
  // Responsive design hook
  const { isMobile } = useResponsive();
  
  // Toast notifications
  const { toast } = useToast();
  
  // Browser compatibility system
  const { compatibilityScore, criticalMissing } = useBrowserCompatibility();
  
  // Performance optimization system
  const {
    currentMode,
    isAutoOptimizationEnabled,
    performanceStatus,
    toggleAutoOptimization,
    setPerformanceMode
  } = usePerformanceOptimizer();
  
  // Get store state and actions for keyboard shortcuts
  const currentTime = useCurrentTime();
  const timelineScale = useTimelineScale();
  const projectSettings = useProjectSettings();
  const selectedClipId = useSelectedClipId();
  const selectedClipIds = useSelectedClipIds();
  const assetLibrary = useAssetLibrary();
  const { 
    setCurrentTime, 
    setTimelineScale, 
    splitClip, 
    deleteSelectedClips, 
    moveSelectedClips 
  } = useAetherActions();
  
  // Get undo/redo functionality
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  
  // Modal states
  const [exportModalOpen, setExportModalOpen] = React.useState(false);
  const [aiAssistantModalOpen, setAiAssistantModalOpen] = React.useState(false);
  const [keyboardShortcutsModalOpen, setKeyboardShortcutsModalOpen] = React.useState(false);
  const [helpCenterOpen, setHelpCenterOpen] = React.useState(false);
  const [performanceDashboardOpen, setPerformanceDashboardOpen] = React.useState(false);
  
  // UI state
  const [showQuickTip, setShowQuickTip] = React.useState(true);
  const [currentTip] = React.useState("Pro tip: Use Spacebar to play/pause your video, or press 'C' to split clips at the playhead position.");
  
  // Performance optimization states - now managed by the performance optimizer
  const useOptimizedComponents = currentMode !== 'normal';
  const [performanceStats, setPerformanceStats] = React.useState({
    memoryUsage: 0,
    frameRate: 60,
    status: 'good' as 'good' | 'warning' | 'critical'
  });

  // Initialize persistence on app startup
  React.useEffect(() => {
    initializePersistence().catch(error => {
      console.error('Failed to initialize persistence:', error);
      toast({
        title: "Persistence Error",
        description: "Failed to load saved project. Starting with empty project.",
        variant: "destructive",
      });
    });
  }, [toast]);

  // Initialize performance monitoring
  React.useEffect(() => {
    performanceMonitor.startMonitoring();
    
    // Update performance stats periodically
    const updateStats = () => {
      setPerformanceStats({
        memoryUsage: performanceMonitor.getMemoryUsageMB(),
        frameRate: performanceMonitor.getFrameRate(),
        status: performanceMonitor.getPerformanceStatus()
      });
    };
    
    const statsInterval = setInterval(updateStats, 2000); // Update every 2 seconds
    
    // Listen for performance mode changes
    const handlePerformanceModeChange = (event: CustomEvent) => {
      const { mode, reason, automatic } = event.detail;
      
      if (automatic) {
        console.log(`App: Performance mode changed to ${mode} (${reason})`);
        toast({
          title: `Performance Mode: ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
          description: `Switched due to ${reason.toLowerCase()}.`,
          variant: mode === 'minimal' ? "destructive" : "warning",
        });
      }
    };

    // Auto-switch based on project size for large projects
    const checkProjectComplexity = () => {
      const totalClips = assetLibrary.length;
      
      if (totalClips > 100 && currentMode === 'normal') {
        setPerformanceMode('optimized');
      } else if (totalClips > 200 && currentMode !== 'minimal') {
        setPerformanceMode('minimal');
      }
    };

    window.addEventListener('performance:modeChange', handlePerformanceModeChange as EventListener);
    
    // Check project complexity on asset library changes
    checkProjectComplexity();
    
    return () => {
      performanceMonitor.stopMonitoring();
      clearInterval(statsInterval);
      window.removeEventListener('performance:modeChange', handlePerformanceModeChange as EventListener);
    };
  }, [assetLibrary.length, currentMode, setPerformanceMode, toast]);

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields or contentEditable elements
      const target = event.target as HTMLElement;
      if (target instanceof HTMLInputElement || 
          target instanceof HTMLTextAreaElement || 
          target.contentEditable === 'true') {
        return;
      }

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          togglePlayPause();
          break;
        case 'Escape':
          event.preventDefault();
          stop();
          break;
        // Delete key for clip removal
        case 'Delete':
        case 'Backspace':
          if (selectedClipIds.length > 0) {
            event.preventDefault();
            deleteSelectedClips();
          }
          break;
        // Zoom shortcuts
        case 'Equal': // Plus key
        case 'NumpadAdd':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setTimelineScale(Math.min(200, timelineScale + 10));
          }
          break;
        case 'Minus':
        case 'NumpadSubtract':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setTimelineScale(Math.max(10, timelineScale - 10));
          }
          break;
        // Navigation shortcuts
        case 'ArrowLeft':
          if (event.shiftKey && selectedClipIds.length > 0) {
            // Shift+Left: nudge selected clips left by 0.1 seconds
            event.preventDefault();
            moveSelectedClips(-0.1);
          } else if (event.ctrlKey || event.metaKey) {
            // Ctrl+Left: jump to previous second
            event.preventDefault();
            setCurrentTime(Math.max(0, Math.floor(currentTime)));
          } else {
            // Left: frame-by-frame navigation (1/30th second for 30fps)
            event.preventDefault();
            const frameTime = 1 / (projectSettings.fps || 30);
            setCurrentTime(Math.max(0, currentTime - frameTime));
          }
          break;
        case 'ArrowRight':
          if (event.shiftKey && selectedClipIds.length > 0) {
            // Shift+Right: nudge selected clips right by 0.1 seconds
            event.preventDefault();
            moveSelectedClips(0.1);
          } else if (event.ctrlKey || event.metaKey) {
            // Ctrl+Right: jump to next second
            event.preventDefault();
            setCurrentTime(Math.min(projectSettings.duration, Math.ceil(currentTime)));
          } else {
            // Right: frame-by-frame navigation (1/30th second for 30fps)
            event.preventDefault();
            const frameTime = 1 / (projectSettings.fps || 30);
            setCurrentTime(Math.min(projectSettings.duration, currentTime + frameTime));
          }
          break;
        case 'ArrowUp':
          if (event.shiftKey && selectedClipIds.length > 0) {
            // Shift+Up: nudge selected clips left by 1 second
            event.preventDefault();
            moveSelectedClips(-1);
          }
          break;
        case 'ArrowDown':
          if (event.shiftKey && selectedClipIds.length > 0) {
            // Shift+Down: nudge selected clips right by 1 second
            event.preventDefault();
            moveSelectedClips(1);
          }
          break;
        case 'Home':
          event.preventDefault();
          setCurrentTime(0);
          break;
        case 'End':
          event.preventDefault();
          setCurrentTime(projectSettings.duration);
          break;
        // Undo/Redo shortcuts
        case 'KeyZ':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (event.shiftKey) {
              // Ctrl+Shift+Z or Cmd+Shift+Z for redo
              redo();
            } else {
              // Ctrl+Z or Cmd+Z for undo
              undo();
            }
          }
          break;
        case 'KeyY':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            // Ctrl+Y or Cmd+Y for redo (alternative)
            redo();
          }
          break;
        // Clip splitting shortcut
        case 'KeyC':
          if (!event.ctrlKey && !event.metaKey && selectedClipId) {
            event.preventDefault();
            // C key for splitting clip at playhead
            splitClip(selectedClipId, currentTime);
          }
          break;
        // Help shortcut
        case 'F1':
          event.preventDefault();
          setKeyboardShortcutsModalOpen(true);
          break;
        // Help shortcut alternative
        case 'Slash':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setKeyboardShortcutsModalOpen(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, stop, currentTime, timelineScale, projectSettings, selectedClipId, selectedClipIds, setCurrentTime, setTimelineScale, splitClip, deleteSelectedClips, moveSelectedClips, undo, redo]);

  // Header component
  const headerComponent = (
    <div 
      className="flex items-center justify-between p-4 bg-gradient-to-r from-background to-background/95 border-b border-border/50"
      role="banner"
    >
      <div className="flex items-center gap-3">
        <GlowEffect color="primary" intensity="medium">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Film className="h-4 w-4 text-primary-foreground" />
          </div>
        </GlowEffect>
        <div>
          <GradientText gradient="primary" className="text-xl font-bold">
            Aether Editor
          </GradientText>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusIndicator status="online" size="sm" />
            <span className="text-xs text-muted-foreground">Ready to edit</span>
          </div>
        </div>
      </div>
      <div className="flex gap-2" role="toolbar" aria-label="Main actions">
        {/* Undo/Redo buttons */}
        <div className="flex gap-1 mr-2" role="group" aria-label="Undo and redo actions">
          <button 
            className={`p-2 rounded-md border ${
              canUndo 
                ? 'bg-background hover:bg-accent text-foreground border-border' 
                : 'bg-muted text-muted-foreground border-border cursor-not-allowed'
            }`}
            onClick={() => undo()}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo last action"
            aria-keyshortcuts="Control+Z"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button 
            className={`p-2 rounded-md border ${
              canRedo 
                ? 'bg-background hover:bg-accent text-foreground border-border' 
                : 'bg-muted text-muted-foreground border-border cursor-not-allowed'
            }`}
            onClick={() => redo()}
            disabled={!canRedo}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            aria-label="Redo last undone action"
            aria-keyshortcuts="Control+Y Control+Shift+Z"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>
        
        {/* Performance dashboard button */}
        <HelpTooltip
          title="Performance Dashboard"
          description="View detailed performance metrics, memory usage, and optimization settings."
          shortcut="Real-time monitoring"
        >
          <button 
            className={`p-2 rounded-md border flex items-center gap-2 transition-all duration-200 ${
              performanceDashboardOpen 
                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-md' 
                : 'bg-background hover:bg-accent text-foreground border-border hover:shadow-sm'
            }`}
            onClick={() => setPerformanceDashboardOpen(true)}
            title="Open performance dashboard"
            aria-label="Open performance dashboard"
          >
            <Activity className="h-4 w-4" />
            <span className="text-xs font-medium">
              Performance
            </span>
          </button>
        </HelpTooltip>
        
        {/* Performance status indicator */}
        <PerformanceStatusIndicator
          mode={currentMode}
          healthy={performanceStatus.healthy}
          issues={performanceStatus.issues}
          className="cursor-pointer"
        />
        
        <HelpTooltip
          title="AI Assistant"
          description="Generate video projects from text descriptions using AI. Create complex timelines automatically."
          shortcut="AI-powered creation"
        >
          <button 
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center gap-2 transition-all duration-200 hover:shadow-md"
            onClick={() => setAiAssistantModalOpen(true)}
            aria-label="Open AI Assistant for project generation"
          >
            <Zap className="h-4 w-4" />
            AI Assistant
          </button>
        </HelpTooltip>
        
        <HelpTooltip
          title="Export Project"
          description="Export your video project to MP4, WebM, or other formats with customizable quality settings."
          shortcut="Render final video"
        >
          <button 
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all duration-200 hover:shadow-md"
            onClick={() => setExportModalOpen(true)}
            aria-label="Export video project"
          >
            <Film className="h-4 w-4 mr-2" />
            Export
          </button>
        </HelpTooltip>
        
        <ThemeToggle size="default" />
        
        {/* Network status indicator */}
        <NetworkStatusCompact />
        
        {/* Browser compatibility indicator */}
        <BrowserCompatibilityIndicator />
        
        {/* Error reporting indicator */}
        <ErrorIndicator />
        
        <HelpButton 
          onClick={() => setHelpCenterOpen(true)}
          size="default"
        />
        
        <HelpTooltip
          title="Keyboard Shortcuts"
          description="View all available keyboard shortcuts and hotkeys for faster editing."
          shortcut="F1"
        >
          <button 
            className="p-2 rounded-md border bg-background hover:bg-accent text-foreground border-border transition-all duration-200 hover:shadow-sm"
            onClick={() => setKeyboardShortcutsModalOpen(true)}
            title="Keyboard Shortcuts (F1)"
            aria-label="Show keyboard shortcuts help"
            aria-keyshortcuts="F1"
          >
            <AlertCircle className="h-4 w-4" />
          </button>
        </HelpTooltip>
      </div>
    </div>
  );

  // Left panel component
  const leftPanelComponent = (
    <FadeIn delay={100}>
      <div className="h-full">
        {useOptimizedComponents ? <VirtualizedAssetLibrary /> : <AssetLibrary />}
      </div>
    </FadeIn>
  );

  // Right panel component  
  const rightPanelComponent = (
    <FadeIn delay={200}>
      <div className="h-full">
        <PropertyInspector />
      </div>
    </FadeIn>
  );

  // Bottom panel component
  const bottomPanelComponent = (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">
            Timeline {useOptimizedComponents && <span className="text-xs text-green-600 ml-2">(Optimized)</span>}
          </h2>
        </div>
        <TransportControls />
      </div>
      <div className="mb-2">
        <TimelineControls />
      </div>
      <div className="flex-1 min-h-0">
        {useOptimizedComponents ? (
          <OptimizedTimeline width={window.innerWidth - (isMobile ? 32 : 632)} height={128} />
        ) : (
          <Timeline width={window.innerWidth - (isMobile ? 32 : 632)} height={128} />
        )}
      </div>
    </div>
  );

  // Main content component
  const mainContentComponent = (
    <div className="h-full flex flex-col p-4">
      {/* Quick tip */}
      {showQuickTip && (
        <div className="mb-4">
          <QuickTip
            tip={currentTip}
            category="shortcuts"
            onDismiss={() => setShowQuickTip(false)}
          />
        </div>
      )}
      
      <FadeIn delay={50}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            Preview 
            {useOptimizedComponents && (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">
                Optimized
              </Badge>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <StatusIndicator 
              status={performanceStats.status === 'good' ? 'online' : 
                     performanceStats.status === 'warning' ? 'away' : 'busy'} 
              size="sm" 
              showLabel 
            />
          </div>
        </div>
        
        <PolishedCard className="flex-1 p-4" hover={false} elevated>
          {useOptimizedComponents ? <OptimizedPreviewWindow /> : <PreviewWindow />}
        </PolishedCard>
      </FadeIn>
    </div>
  );

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" enableTransitions>
        <HelpProvider>
          <NotificationProvider>
            <TooltipProvider>
          <div 
            className="h-screen w-screen bg-background text-foreground overflow-hidden"
            role="application"
            aria-label="Aether Video Editor"
          >
            {/* Network status banner for offline states */}
            <NetworkStatusBanner />
            
            {/* Skip links for accessibility */}
            <SkipLink href="#main-content">Skip to main content</SkipLink>
            <SkipLink href="#timeline">Skip to timeline</SkipLink>
            <SkipLink href="#asset-library">Skip to asset library</SkipLink>
            
            {/* Live region for screen reader announcements */}
            <LiveRegion>
              <span id="announcements" aria-live="polite" aria-atomic="true"></span>
            </LiveRegion>
            
            {/* Screen reader only instructions */}
            <ScreenReaderOnly>
              <h1>Aether Video Editor</h1>
              <p>A professional video editing application with timeline, preview, asset library, and property inspector.</p>
              <p>Use Tab to navigate between interface elements. Press F1 for keyboard shortcuts.</p>
            </ScreenReaderOnly>
          <ResponsiveLayout
            header={headerComponent}
            leftPanel={<div id="asset-library">{leftPanelComponent}</div>}
            rightPanel={rightPanelComponent}
            bottomPanel={<div id="timeline">{bottomPanelComponent}</div>}
            leftPanelTitle="Asset library"
            rightPanelTitle="Property inspector"
            bottomPanelTitle="Video timeline"
          >
            <div id="main-content">{mainContentComponent}</div>
          </ResponsiveLayout>
          
          {/* Export Modal */}
          <ExportModal 
            open={exportModalOpen} 
            onOpenChange={setExportModalOpen} 
          />
          
          {/* AI Assistant Modal */}
          <AiAssistantModal 
            open={aiAssistantModalOpen} 
            onOpenChange={setAiAssistantModalOpen} 
          />
          
          {/* Keyboard Shortcuts Modal */}
          <KeyboardShortcutsModal 
            open={keyboardShortcutsModalOpen} 
            onOpenChange={setKeyboardShortcutsModalOpen} 
          />
          
          {/* Help Center Modal */}
          <HelpCenter 
            open={helpCenterOpen} 
            onOpenChange={setHelpCenterOpen} 
          />
          
          {/* Performance Dashboard */}
          <PerformanceDashboard
            isOpen={performanceDashboardOpen}
            onClose={() => setPerformanceDashboardOpen(false)}
          />
          
          {/* Performance Notifications */}
          <PerformanceNotification />
          
          {/* Hidden audio container for audio playback */}
          <div id="audio-container" className="hidden" aria-hidden="true" />
          
          {/* Toast notifications */}
          <Toaster />
          
          {/* Notification system */}
          <ToastContainer />
        </div>
      </TooltipProvider>
    </NotificationProvider>
  </HelpProvider>
</ThemeProvider>
</ErrorBoundary>
  );
}

export default App;