import { describe, it, expect, beforeEach } from 'vitest';
import { filmstripCache } from '../filmstripCache';

// Mock HTMLImageElement
class MockImage {
  src = '';
  crossOrigin: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 120;
  height = 68;
  naturalWidth = 120;
  naturalHeight = 68;

  constructor() {
    // Simulate successful image loading after a short delay
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 10);
  }
}

// Mock window.Image
Object.defineProperty(window, 'Image', {
  writable: true,
  value: MockImage
});

describe('FilmstripCache', () => {
  beforeEach(() => {
    filmstripCache.clear();
  });

  it('should cache and retrieve images', async () => {
    const assetId = 'test-asset-1';
    const filmstripUrl = 'http://example.com/filmstrip.jpg';

    // Load image (should cache it)
    const image1 = await filmstripCache.loadImage(assetId, filmstripUrl);
    expect(image1).toBeInstanceOf(MockImage);

    // Get cached image
    const cachedImage = filmstripCache.getImage(assetId, filmstripUrl);
    expect(cachedImage).toBe(image1);
  });

  it('should return null for non-existent cache entries', () => {
    const cachedImage = filmstripCache.getImage('non-existent', 'http://example.com/test.jpg');
    expect(cachedImage).toBeNull();
  });

  it('should invalidate cache when URL changes', async () => {
    const assetId = 'test-asset-1';
    const filmstripUrl1 = 'http://example.com/filmstrip1.jpg';
    const filmstripUrl2 = 'http://example.com/filmstrip2.jpg';

    // Load first image
    await filmstripCache.loadImage(assetId, filmstripUrl1);
    
    // Try to get with different URL - should return null
    const cachedImage = filmstripCache.getImage(assetId, filmstripUrl2);
    expect(cachedImage).toBeNull();
  });

  it('should provide comprehensive cache statistics', async () => {
    const stats1 = filmstripCache.getStats();
    expect(stats1.size).toBe(0);
    expect(stats1.maxSize).toBe(150); // Updated cache size
    expect(stats1.totalMemoryUsage).toBe(0);
    expect(stats1.maxMemoryUsage).toBe(75 * 1024 * 1024); // Updated memory limit
    expect(stats1.hitRate).toBe(0);
    expect(stats1.totalRequests).toBe(0);
    expect(stats1.cacheHits).toBe(0);

    // Add an image to cache
    await filmstripCache.loadImage('test-asset', 'http://example.com/test.jpg');
    
    const stats2 = filmstripCache.getStats();
    expect(stats2.size).toBe(1);
    expect(stats2.totalMemoryUsage).toBeGreaterThan(0);
    expect(stats2.totalRequests).toBeGreaterThan(0);
  });

  it('should clear all cache entries and reset stats', async () => {
    // Add some images to cache
    await filmstripCache.loadImage('asset1', 'http://example.com/1.jpg');
    await filmstripCache.loadImage('asset2', 'http://example.com/2.jpg');
    
    const statsBefore = filmstripCache.getStats();
    expect(statsBefore.size).toBe(2);
    expect(statsBefore.totalMemoryUsage).toBeGreaterThan(0);
    
    // Clear cache
    filmstripCache.clear();
    
    const statsAfter = filmstripCache.getStats();
    expect(statsAfter.size).toBe(0);
    expect(statsAfter.totalMemoryUsage).toBe(0);
    expect(statsAfter.totalRequests).toBe(0);
    expect(statsAfter.cacheHits).toBe(0);
  });

  it('should support preloading filmstrips', async () => {
    const assetId = 'preload-asset';
    const filmstripUrl = 'http://example.com/preload.jpg';

    // Preload should not throw
    await expect(filmstripCache.preloadFilmstrip(assetId, filmstripUrl)).resolves.toBeUndefined();
    
    // Image should be cached after preload
    const cachedImage = filmstripCache.getImage(assetId, filmstripUrl);
    expect(cachedImage).toBeInstanceOf(MockImage);
  });

  it('should support batch preloading', async () => {
    const items = [
      { assetId: 'batch1', filmstripUrl: 'http://example.com/batch1.jpg' },
      { assetId: 'batch2', filmstripUrl: 'http://example.com/batch2.jpg' }
    ];

    // Batch preload should not throw
    await expect(filmstripCache.preloadBatch(items)).resolves.toBeUndefined();
    
    // Both images should be cached
    expect(filmstripCache.getImage('batch1', 'http://example.com/batch1.jpg')).toBeInstanceOf(MockImage);
    expect(filmstripCache.getImage('batch2', 'http://example.com/batch2.jpg')).toBeInstanceOf(MockImage);
  });

  it('should track cache hit rate', async () => {
    const assetId = 'hit-rate-test';
    const filmstripUrl = 'http://example.com/hit-rate.jpg';

    // Load image first time
    await filmstripCache.loadImage(assetId, filmstripUrl);
    
    // Get cached image multiple times
    filmstripCache.getImage(assetId, filmstripUrl);
    filmstripCache.getImage(assetId, filmstripUrl);
    filmstripCache.getImage(assetId, filmstripUrl);
    
    const stats = filmstripCache.getStats();
    expect(stats.hitRate).toBeGreaterThan(0);
    expect(stats.cacheHits).toBeGreaterThan(0);
    expect(stats.totalRequests).toBeGreaterThan(stats.cacheHits);
  });

  it('should handle enhanced memory estimation for larger filmstrips', async () => {
    // Create a mock image with larger dimensions (simulating enhanced filmstrip)
    class LargeFilmstripImage extends MockImage {
      width = 160 * 50; // 50 frames at 160px width
      height = 90;
      naturalWidth = 160 * 50;
      naturalHeight = 90;
    }

    // Temporarily replace Image constructor
    const originalImage = window.Image;
    (window as any).Image = LargeFilmstripImage;

    try {
      const assetId = 'large-filmstrip';
      const filmstripUrl = 'http://example.com/large-filmstrip.jpg';

      await filmstripCache.loadImage(assetId, filmstripUrl);
      
      const stats = filmstripCache.getStats();
      expect(stats.totalMemoryUsage).toBeGreaterThan(100000); // Should be substantial for large filmstrip
    } finally {
      // Restore original Image constructor
      (window as any).Image = originalImage;
    }
  });

  it('should prevent duplicate loading requests', async () => {
    const assetId = 'duplicate-test';
    const filmstripUrl = 'http://example.com/duplicate.jpg';

    // Start multiple load requests simultaneously
    const promises = [
      filmstripCache.loadImage(assetId, filmstripUrl),
      filmstripCache.loadImage(assetId, filmstripUrl),
      filmstripCache.loadImage(assetId, filmstripUrl)
    ];

    const results = await Promise.all(promises);
    
    // All should return the same image instance
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
    
    // Should only have one cache entry
    const stats = filmstripCache.getStats();
    expect(stats.size).toBe(1);
  });
});