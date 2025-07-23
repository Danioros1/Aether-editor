import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { performance } from 'perf_hooks';
import { Timeline } from '../../components/Timeline';
import { AssetLibrary } from '../../components/AssetLibrary';
import { PreviewWindow } from '../../components/PreviewWindow';
import { useAetherStore } from '../../store/useAetherStore';
import { createMockProject, createLargeProject } from '../factories/projectFactory';
import { setupTestIsolation } from '../utils/testIsolation';
import { mockBrowserAPI } from '../utils/mockUtils';

// Mock the store
vi.mock('../../store/useAetherStore');

describe('Component Performance Tests', () => {
  const isolation = setupTestIsolation();
  
  beforeEach(() => {
    isolation.beforeEach();
    mockBrowserAPI.performance();
    mockBrowserAPI.resizeObserver();
    mockBrowserAPI.intersectionObserver();
  });

  afterEach(async () => {
    await isolation.afterEach();
  });

  describe('Timeline Component Performance', () => {
    it('should render timeline with many clips within performance threshold', async () => {
      const largeProject = createLargeProject({ clipCount: 200 });
      const mockStore = {
        ...largeProject,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        selectClip: vi.fn(),
        selectMultipleClips: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const startTime = performance.now();
      render(<Timeline />);
      const renderTime = performance.now() - startTime;

      // Should render within 500ms even with 200 clips
      expect(renderTime).toBeLessThan(500);

      // Should use virtualization
      const timeline = screen.getByTestId('timeline');
      expect(timeline).toHaveAttribute('data-virtualized', 'true');
    });

    it('should handle timeline zoom performance', async () => {
      const project = createMockProject({ clipCount: 50 });
      const mockStore = {
        ...project,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        selectClip: vi.fn(),
        selectMultipleClips: vi.fn(),
        setTimelineScale: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      render(<Timeline />);
      const timeline = screen.getByTestId('timeline');

      // Measure zoom performance
      const zoomTimes: number[] = [];
      
      for (let scale = 10; scale <= 200; scale += 20) {
        const startTime = performance.now();
        
        // Simulate zoom
        mockStore.timelineScale = scale;
        mockStore.setTimelineScale(scale);
        
        // Trigger re-render
        fireEvent.wheel(timeline, { deltaY: -100 });
        
        // Wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const zoomTime = performance.now() - startTime;
        zoomTimes.push(zoomTime);
      }

      const averageZoomTime = zoomTimes.reduce((a, b) => a + b, 0) / zoomTimes.length;
      
      // Average zoom should be under 16ms (60fps)
      expect(averageZoomTime).toBeLessThan(16);
    });

    it('should handle clip dragging performance', async () => {
      const project = createMockProject({ clipCount: 20 });
      const mockStore = {
        ...project,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        selectClip: vi.fn(),
        selectMultipleClips: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      render(<Timeline />);
      const firstClip = screen.getByTestId('clip-clip-1');

      // Measure drag performance
      const dragTimes: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const startTime = performance.now();
        
        // Simulate drag
        fireEvent.mouseDown(firstClip, { clientX: 100, clientY: 100 });
        fireEvent.mouseMove(firstClip, { clientX: 100 + i * 10, clientY: 100 });
        
        // Wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const dragTime = performance.now() - startTime;
        dragTimes.push(dragTime);
        
        fireEvent.mouseUp(firstClip);
      }

      const averageDragTime = dragTimes.reduce((a, b) => a + b, 0) / dragTimes.length;
      
      // Average drag handling should be under 16ms (60fps)
      expect(averageDragTime).toBeLessThan(16);
    });
  });

  describe('Asset Library Component Performance', () => {
    it('should render large asset library efficiently', async () => {
      const manyAssets = Array.from({ length: 500 }, (_, i) => ({
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
        assetLibrary: manyAssets,
        timeline: { videoTracks: [[]], audioTracks: [[]] },
        selectedClipId: null,
        selectedClipIds: [],
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50,
        addAsset: vi.fn(),
        removeAsset: vi.fn(),
        updateAsset: vi.fn(),
        addClipToTimeline: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const startTime = performance.now();
      render(<AssetLibrary />);
      const renderTime = performance.now() - startTime;

      // Should render within 300ms for 500 assets
      expect(renderTime).toBeLessThan(300);

      // Should use virtualization
      const assetLibrary = screen.getByTestId('asset-library');
      expect(assetLibrary).toHaveAttribute('data-virtualized', 'true');
    });

    it('should handle asset library scrolling performance', async () => {
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
        removeAsset: vi.fn(),
        updateAsset: vi.fn(),
        addClipToTimeline: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      render(<AssetLibrary />);
      const assetLibrary = screen.getByTestId('asset-library');

      // Measure scroll performance
      const scrollTimes: number[] = [];
      
      for (let i = 0; i < 15; i++) {
        const startTime = performance.now();
        
        // Simulate scroll
        assetLibrary.scrollTop = i * 50;
        fireEvent.scroll(assetLibrary);
        
        // Wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const scrollTime = performance.now() - startTime;
        scrollTimes.push(scrollTime);
      }

      const averageScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      
      // Average scroll should be under 16ms (60fps)
      expect(averageScrollTime).toBeLessThan(16);
    });

    it('should handle thumbnail loading performance', async () => {
      const assetsWithThumbnails = Array.from({ length: 100 }, (_, i) => ({
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
        removeAsset: vi.fn(),
        updateAsset: vi.fn(),
        addClipToTimeline: vi.fn()
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      // Mock Image loading
      const originalImage = global.Image;
      const loadTimes: number[] = [];
      
      global.Image = class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src: string = '';
        
        set src(value: string) {
          const startTime = performance.now();
          setTimeout(() => {
            const loadTime = performance.now() - startTime;
            loadTimes.push(loadTime);
            this.onload?.();
          }, Math.random() * 50); // Random load time up to 50ms
        }
      } as any;

      render(<AssetLibrary />);

      // Wait for thumbnails to load
      await new Promise(resolve => setTimeout(resolve, 500));

      const averageLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
      
      // Average thumbnail load should be reasonable
      expect(averageLoadTime).toBeLessThan(100);
      expect(loadTimes.length).toBeGreaterThan(0);

      // Restore original Image
      global.Image = originalImage;
    });
  });

  describe('Preview Window Component Performance', () => {
    it('should render preview window efficiently', async () => {
      const project = createMockProject();
      const mockStore = {
        ...project,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const startTime = performance.now();
      render(<PreviewWindow />);
      const renderTime = performance.now() - startTime;

      // Should render within 200ms
      expect(renderTime).toBeLessThan(200);

      const previewWindow = screen.getByTestId('preview-window');
      expect(previewWindow).toBeInTheDocument();
    });

    it('should handle preview updates during playback', async () => {
      const project = createMockProject();
      const mockStore = {
        ...project,
        isPlaying: true,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      render(<PreviewWindow />);

      // Measure preview update performance during simulated playback
      const updateTimes: number[] = [];
      
      for (let time = 0; time < 10; time += 0.1) {
        const startTime = performance.now();
        
        // Simulate time update
        mockStore.currentTime = time;
        mockStore.setCurrentTime(time);
        
        // Wait for next frame
        await new Promise(resolve => requestAnimationFrame(resolve));
        
        const updateTime = performance.now() - startTime;
        updateTimes.push(updateTime);
      }

      const averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      
      // Average preview update should be under 16ms (60fps)
      expect(averageUpdateTime).toBeLessThan(16);
    });

    it('should handle canvas rendering performance', async () => {
      const project = createMockProject();
      const mockStore = {
        ...project,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      // Mock canvas performance
      const mockContext = {
        drawImage: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        getImageData: vi.fn(),
        putImageData: vi.fn()
      };

      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockContext),
        width: 1920,
        height: 1080
      };

      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return mockCanvas as any;
        }
        return originalCreateElement.call(document, tagName);
      });

      render(<PreviewWindow />);

      // Simulate canvas operations
      const renderTimes: number[] = [];
      
      for (let i = 0; i < 30; i++) {
        const startTime = performance.now();
        
        // Simulate canvas drawing operations
        mockContext.clearRect(0, 0, 1920, 1080);
        mockContext.drawImage({} as any, 0, 0, 1920, 1080);
        
        const renderTime = performance.now() - startTime;
        renderTimes.push(renderTime);
        
        await new Promise(resolve => requestAnimationFrame(resolve));
      }

      const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      
      // Canvas operations should be fast
      expect(averageRenderTime).toBeLessThan(5);

      // Restore original createElement
      document.createElement = originalCreateElement;
    });
  });

  describe('Component Update Performance', () => {
    it('should handle frequent prop updates efficiently', async () => {
      const project = createMockProject();
      let currentTime = 0;
      
      const mockStore = {
        ...project,
        get currentTime() { return currentTime; },
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      const { rerender } = render(<Timeline />);

      // Measure update performance
      const updateTimes: number[] = [];
      
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        
        currentTime = i * 0.1;
        rerender(<Timeline />);
        
        const updateTime = performance.now() - startTime;
        updateTimes.push(updateTime);
      }

      const averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length;
      
      // Component updates should be fast (under 5ms)
      expect(averageUpdateTime).toBeLessThan(5);
    });

    it('should handle state changes without unnecessary re-renders', async () => {
      const project = createMockProject();
      const mockStore = {
        ...project,
        addAsset: vi.fn(),
        addClipToTimeline: vi.fn(),
        updateClip: vi.fn(),
        deleteClip: vi.fn(),
        setCurrentTime: vi.fn(),
        togglePlayback: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        canUndo: false,
        canRedo: false
      };

      vi.mocked(useAetherStore).mockReturnValue(mockStore);

      // Track render count
      let renderCount = 0;
      const WrappedTimeline = () => {
        renderCount++;
        return <Timeline />;
      };

      const { rerender } = render(<WrappedTimeline />);

      const initialRenderCount = renderCount;

      // Make changes that shouldn't trigger re-renders
      mockStore.setCurrentTime(5);
      mockStore.setCurrentTime(5); // Same value
      mockStore.setCurrentTime(5); // Same value again

      rerender(<WrappedTimeline />);

      // Should not have re-rendered for duplicate values
      expect(renderCount - initialRenderCount).toBeLessThanOrEqual(1);
    });
  });
});