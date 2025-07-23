import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { performance } from 'perf_hooks';
import App from '../../App';
import { useAetherStore } from '../../store/useAetherStore';
import { createLargeProject } from '../factories/projectFactory';
import { setupTestIsolation } from '../utils/testIsolation';
import { mockBrowserAPI } from '../utils/mockUtils';

// Mock the store
vi.mock('../../store/useAetherStore');

describe('Rendering Performance Tests', () => {
  const isolation = setupTestIsolation();
  
  beforeEach(() => {
    isolation.beforeEach();
    mockBrowserAPI.performance();
  });

  afterEach(async () => {
    await isolation.afterEach();
  });

  describe('Initial Render Performance', () => {
    it('should render empty project within performance threshold', async () => {
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

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should render within 100ms for empty project
      expect(renderTime).toBeLessThan(100);
      
      // Should have main components rendered
      expect(screen.getByTestId('timeline')).toBeInTheDocument();
      expect(screen.getByTestId('asset-library')).toBeInTheDocument();
      expect(screen.getByTestId('preview-window')).toBeInTheDocument();
    });

    it('should render large project within performance threshold', async () => {
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

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should render within 2 seconds even for large projects
      expect(renderTime).toBeLessThan(2000);
      
      // Should use virtualization for large lists
      const assetLibrary = screen.getByTestId('asset-library');
      expect(assetLibrary).toHaveAttribute('data-virtualized', 'true');
    });
  });

  describe('Timeline Rendering Performance', () => {
    it('should render timeline with many clips efficiently', async () => {
      const manyClips = Array.from({ length: 100 }, (_, i) => ({
        clipId: `clip-${i}`,
        assetId: `asset-${i}`,
        startTime: i * 2,
        duration: 1,
        volume: 1,
        textOverlays: []
      }));

      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 200 },
        assetLibrary: [],
        timeline: { videoTracks: [manyClips], audioTracks: [[]] },
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

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should render within 1 second for 100 clips
      expect(renderTime).toBeLessThan(1000);

      // Should use virtualization
      const timeline = screen.getByTestId('timeline');
      expect(timeline).toHaveAttribute('data-virtualized', 'true');
    });

    it('should handle timeline scrolling performance', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 600 },
        assetLibrary: [],
        timeline: { 
          videoTracks: [Array.from({ length: 200 }, (_, i) => ({
            clipId: `clip-${i}`,
            assetId: `asset-${i}`,
            startTime: i * 3,
            duration: 2,
            volume: 1,
            textOverlays: []
          }))], 
          audioTracks: [[]] 
        },
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

      render(<App />);
      const timeline = screen.getByTestId('timeline');

      // Measure scroll performance
      const scrollTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        // Simulate scroll event
        timeline.scrollLeft = i * 100;
        timeline.dispatchEvent(new Event('scroll'));
        
        // Wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const scrollTime = performance.now() - startTime;
        scrollTimes.push(scrollTime);
      }

      const averageScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      
      // Average scroll handling should be under 16ms (60fps)
      expect(averageScrollTime).toBeLessThan(16);
    });
  });

  describe('Asset Library Performance', () => {
    it('should render large asset library efficiently', async () => {
      const manyAssets = Array.from({ length: 200 }, (_, i) => ({
        assetId: `asset-${i}`,
        fileName: `asset-${i}.jpg`,
        type: 'image' as const,
        sourceUrl: `http://localhost:3001/uploads/asset-${i}.jpg`,
        duration: 5,
        isPlaceholder: false
      }));

      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: manyAssets,
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

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should render within 500ms for 200 assets
      expect(renderTime).toBeLessThan(500);

      // Should use virtualization
      const assetLibrary = screen.getByTestId('asset-library');
      expect(assetLibrary).toHaveAttribute('data-virtualized', 'true');
    });

    it('should handle asset thumbnail loading performance', async () => {
      const assetsWithThumbnails = Array.from({ length: 50 }, (_, i) => ({
        assetId: `asset-${i}`,
        fileName: `asset-${i}.jpg`,
        type: 'image' as const,
        sourceUrl: `http://localhost:3001/uploads/asset-${i}.jpg`,
        thumbnailUrl: `http://localhost:3001/uploads/asset-${i}-thumb.jpg`,
        duration: 5,
        isPlaceholder: false
      }));

      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 0 },
        assetLibrary: assetsWithThumbnails,
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

      const startTime = performance.now();
      render(<App />);
      
      // Wait for thumbnails to start loading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const loadTime = performance.now() - startTime;

      // Should start rendering thumbnails within 200ms
      expect(loadTime).toBeLessThan(200);

      // Should use lazy loading
      const thumbnails = screen.getAllByTestId(/asset-thumbnail/);
      expect(thumbnails.length).toBeGreaterThan(0);
      
      // Not all thumbnails should be loaded immediately (lazy loading)
      const loadedThumbnails = thumbnails.filter(thumb => 
        thumb.getAttribute('data-loaded') === 'true'
      );
      expect(loadedThumbnails.length).toBeLessThan(thumbnails.length);
    });
  });

  describe('Preview Window Performance', () => {
    it('should handle video preview rendering efficiently', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 10 },
        assetLibrary: [{
          assetId: 'video-asset-1',
          fileName: 'test-video.mp4',
          type: 'video' as const,
          sourceUrl: 'http://localhost:3001/uploads/test-video.mp4',
          duration: 10,
          isPlaceholder: false
        }],
        timeline: { 
          videoTracks: [[{
            clipId: 'clip-1',
            assetId: 'video-asset-1',
            startTime: 0,
            duration: 10,
            volume: 1,
            textOverlays: []
          }]], 
          audioTracks: [[]] 
        },
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

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should render preview within 300ms
      expect(renderTime).toBeLessThan(300);

      const previewWindow = screen.getByTestId('preview-window');
      expect(previewWindow).toBeInTheDocument();

      // Should use hardware acceleration
      expect(previewWindow).toHaveAttribute('data-hardware-accelerated', 'true');
    });

    it('should maintain 60fps during playback', async () => {
      const mockStore = {
        projectSettings: { name: 'Test', resolution: '1080p' as const, fps: 30, duration: 10 },
        assetLibrary: [],
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: true, // Start playing
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

      render(<App />);

      // Measure frame times during playback simulation
      const frameTimes: number[] = [];
      let lastFrameTime = performance.now();

      for (let i = 0; i < 60; i++) { // Test 60 frames
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const currentTime = performance.now();
        const frameTime = currentTime - lastFrameTime;
        frameTimes.push(frameTime);
        lastFrameTime = currentTime;
      }

      const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = 1000 / averageFrameTime;

      // Should maintain at least 50fps (allowing some variance)
      expect(fps).toBeGreaterThan(50);

      // No frame should take longer than 20ms (50fps minimum)
      const slowFrames = frameTimes.filter(time => time > 20);
      expect(slowFrames.length).toBeLessThan(frameTimes.length * 0.1); // Less than 10% slow frames
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during normal operations', async () => {
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

      // Render and perform operations
      const { unmount } = render(<App />);

      // Simulate user interactions
      for (let i = 0; i < 100; i++) {
        mockStore.setCurrentTime(i);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const afterOperationsMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = afterOperationsMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for basic operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Cleanup
      unmount();

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryAfterCleanup = finalMemory - initialMemory;

      // Memory should be mostly cleaned up (within 5MB of initial)
      expect(memoryAfterCleanup).toBeLessThan(5 * 1024 * 1024);
    });

    it('should handle memory pressure gracefully', async () => {
      // Mock high memory usage
      mockBrowserAPI.performance({
        usedJSHeapSize: 900 * 1024 * 1024, // 900MB
        totalJSHeapSize: 1024 * 1024 * 1024, // 1GB
        jsHeapSizeLimit: 1024 * 1024 * 1024
      });

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

      const startTime = performance.now();
      render(<App />);
      const renderTime = performance.now() - startTime;

      // Should still render within reasonable time even under memory pressure
      expect(renderTime).toBeLessThan(1000);

      // Should enable performance mode
      expect(screen.getByTestId('performance-mode-indicator')).toBeInTheDocument();
    });
  });
});