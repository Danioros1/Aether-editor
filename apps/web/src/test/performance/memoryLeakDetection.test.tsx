import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { performance } from 'perf_hooks';
import App from '../../App';
import { useAetherStore } from '../../store/useAetherStore';
import { createLargeProject } from '../factories/projectFactory';
import { setupTestIsolation } from '../utils/testIsolation';
import { mockBrowserAPI } from '../utils/mockUtils';

// Mock the store
vi.mock('../../store/useAetherStore');

describe('Memory Leak Detection Tests', () => {
  const isolation = setupTestIsolation();
  
  beforeEach(() => {
    isolation.beforeEach();
    mockBrowserAPI.performance();
  });

  afterEach(async () => {
    cleanup();
    await isolation.afterEach();
  });

  describe('Component Memory Leaks', () => {
    it('should not leak memory when mounting and unmounting components', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memorySnapshots: number[] = [];

      // Mount and unmount multiple times
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(<App />);
        
        // Wait for render to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
        memorySnapshots.push(currentMemory - initialMemory);
        
        unmount();
        cleanup();
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Memory should not continuously increase
      const memoryTrend = memorySnapshots.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const earlyMemory = memorySnapshots.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
      
      // Memory growth should be minimal (less than 5MB difference)
      expect(memoryTrend - earlyMemory).toBeLessThan(5 * 1024 * 1024);
    });

    it('should clean up event listeners properly', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      // Track event listeners
      const originalAddEventListener = EventTarget.prototype.addEventListener;
      const originalRemoveEventListener = EventTarget.prototype.removeEventListener;
      
      const activeListeners = new Map<EventTarget, Map<string, Set<EventListener>>>();
      
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        if (!activeListeners.has(this)) {
          activeListeners.set(this, new Map());
        }
        if (!activeListeners.get(this)!.has(type)) {
          activeListeners.get(this)!.set(type, new Set());
        }
        activeListeners.get(this)!.get(type)!.add(listener as EventListener);
        
        return originalAddEventListener.call(this, type, listener, options);
      };
      
      EventTarget.prototype.removeEventListener = function(type, listener, options) {
        if (activeListeners.has(this) && activeListeners.get(this)!.has(type)) {
          activeListeners.get(this)!.get(type)!.delete(listener as EventListener);
        }
        
        return originalRemoveEventListener.call(this, type, listener, options);
      };

      const { unmount } = render(<App />);
      
      // Count listeners after mount
      let totalListenersAfterMount = 0;
      activeListeners.forEach(elementListeners => {
        elementListeners.forEach(typeListeners => {
          totalListenersAfterMount += typeListeners.size;
        });
      });

      unmount();
      cleanup();

      // Count listeners after unmount
      let totalListenersAfterUnmount = 0;
      activeListeners.forEach(elementListeners => {
        elementListeners.forEach(typeListeners => {
          totalListenersAfterUnmount += typeListeners.size;
        });
      });

      // Should have cleaned up most listeners (allowing for some global listeners)
      const leakedListeners = totalListenersAfterUnmount;
      expect(leakedListeners).toBeLessThan(totalListenersAfterMount * 0.1); // Less than 10% should remain

      // Restore original methods
      EventTarget.prototype.addEventListener = originalAddEventListener;
      EventTarget.prototype.removeEventListener = originalRemoveEventListener;
    });

    it('should clean up timers and intervals', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: true, // Start playing to trigger timers
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      // Track timers
      const originalSetTimeout = global.setTimeout;
      const originalSetInterval = global.setInterval;
      const originalClearTimeout = global.clearTimeout;
      const originalClearInterval = global.clearInterval;
      
      const activeTimers = new Set<NodeJS.Timeout>();
      const activeIntervals = new Set<NodeJS.Timeout>();
      
      global.setTimeout = ((callback: any, delay?: number) => {
        const timer = originalSetTimeout(callback, delay);
        activeTimers.add(timer);
        return timer;
      }) as any;
      
      global.setInterval = ((callback: any, delay?: number) => {
        const interval = originalSetInterval(callback, delay);
        activeIntervals.add(interval);
        return interval;
      }) as any;
      
      global.clearTimeout = (timer: NodeJS.Timeout) => {
        activeTimers.delete(timer);
        return originalClearTimeout(timer);
      };
      
      global.clearInterval = (interval: NodeJS.Timeout) => {
        activeIntervals.delete(interval);
        return originalClearInterval(interval);
      };

      const { unmount } = render(<App />);
      
      // Let some timers be created
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const timersAfterMount = activeTimers.size;
      const intervalsAfterMount = activeIntervals.size;

      unmount();
      cleanup();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const timersAfterUnmount = activeTimers.size;
      const intervalsAfterUnmount = activeIntervals.size;

      // Should have cleaned up most timers and intervals
      expect(timersAfterUnmount).toBeLessThan(timersAfterMount * 0.2); // Less than 20% should remain
      expect(intervalsAfterUnmount).toBe(0); // All intervals should be cleaned up

      // Restore original methods
      global.setTimeout = originalSetTimeout;
      global.setInterval = originalSetInterval;
      global.clearTimeout = originalClearTimeout;
      global.clearInterval = originalClearInterval;
    });
  });

  describe('Store Memory Leaks', () => {
    it('should not leak memory when updating store frequently', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      render(<App />);

      // Simulate frequent store updates
      for (let i = 0; i < 1000; i++) {
        mockStore.currentTime = i;
        mockStore.setCurrentTime(i);
        
        // Trigger re-render occasionally
        if (i % 100 === 0) {
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable for 1000 updates (less than 20MB)
      expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });

    it('should handle large project data without memory leaks', async () => {
      const largeProject = createLargeProject();
      const mockStore = {
        ...largeProject,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const { unmount } = render(<App />);

      // Wait for rendering to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const afterRenderMemory = (performance as any).memory?.usedJSHeapSize || 0;

      unmount();
      cleanup();

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      const afterCleanupMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const renderMemoryIncrease = afterRenderMemory - initialMemory;
      const cleanupMemoryIncrease = afterCleanupMemory - initialMemory;

      // Should use reasonable memory for large project (less than 100MB)
      expect(renderMemoryIncrease).toBeLessThan(100 * 1024 * 1024);

      // Should clean up most memory after unmount (within 20MB of initial)
      expect(cleanupMemoryIncrease).toBeLessThan(20 * 1024 * 1024);
    });
  });

  describe('Asset Memory Leaks', () => {
    it('should clean up asset references when removed', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      render(<App />);

      // Add many assets
      const assets = Array.from({ length: 100 }, (_, i) => ({
        assetId: `asset-${i}`,
        fileName: `asset-${i}.jpg`,
        type: 'image' as const,
        sourceUrl: `http://localhost:3001/uploads/asset-${i}.jpg`,
        duration: 5,
        isPlaceholder: false
      }));

      mockStore.assetLibrary = assets;

      // Wait for assets to be processed
      await new Promise(resolve => setTimeout(resolve, 200));

      const afterAssetsMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Clear assets
      mockStore.assetLibrary = [];

      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 200));

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = (performance as any).memory?.usedJSHeapSize || 0;

      const assetsMemoryIncrease = afterAssetsMemory - initialMemory;
      const clearMemoryIncrease = afterClearMemory - initialMemory;

      // Should use memory for assets
      expect(assetsMemoryIncrease).toBeGreaterThan(0);

      // Should clean up most asset memory (within 80% of original increase)
      expect(clearMemoryIncrease).toBeLessThan(assetsMemoryIncrease * 0.2);
    });

    it('should handle video asset memory properly', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [{
          assetId: 'video-asset-1',
          fileName: 'large-video.mp4',
          type: 'video' as const,
          sourceUrl: 'http://localhost:3001/uploads/large-video.mp4',
          thumbnailUrl: 'http://localhost:3001/uploads/large-video-thumb.jpg',
          filmstripUrl: 'http://localhost:3001/uploads/large-video-filmstrip.jpg',
          duration: 300, // 5 minutes
          isPlaceholder: false
        }],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const { unmount } = render(<App />);

      // Simulate video loading and processing
      await new Promise(resolve => setTimeout(resolve, 300));

      const memoryAfterVideo = (performance as any).memory?.usedJSHeapSize || 0;

      unmount();
      cleanup();

      // Force garbage collection multiple times for video cleanup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
        global.gc();
      }

      const memoryAfterCleanup = (performance as any).memory?.usedJSHeapSize || 0;

      // Video should not cause excessive memory usage (less than 50MB)
      expect(memoryAfterVideo).toBeLessThan(50 * 1024 * 1024);

      // Should clean up video memory properly
      expect(memoryAfterCleanup).toBeLessThan(memoryAfterVideo * 0.8);
    });
  });

  describe('Canvas and WebGL Memory Leaks', () => {
    it('should clean up canvas contexts properly', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false,
        exportProject: vi.fn(),
        loadProject: vi.fn(),
        saveProject: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      // Track canvas creation
      const originalCreateElement = document.createElement;
      const canvasElements: HTMLCanvasElement[] = [];
      
      document.createElement = function(tagName: string) {
        const element = originalCreateElement.call(this, tagName);
        if (tagName === 'canvas') {
          canvasElements.push(element as HTMLCanvasElement);
        }
        return element;
      };

      const { unmount } = render(<App />);

      // Wait for canvas creation
      await new Promise(resolve => setTimeout(resolve, 200));

      const canvasCount = canvasElements.length;
      expect(canvasCount).toBeGreaterThan(0); // Should create some canvas elements

      unmount();
      cleanup();

      // Check that canvas elements are properly cleaned up
      const activeCanvases = canvasElements.filter(canvas => 
        document.contains(canvas) || canvas.parentNode !== null
      );

      expect(activeCanvases.length).toBe(0); // All canvases should be cleaned up

      // Restore original method
      document.createElement = originalCreateElement;
    });
  });
});