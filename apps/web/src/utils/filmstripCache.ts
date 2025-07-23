// Enhanced filmstrip caching utility for better performance and memory management

interface FilmstripCacheEntry {
  image: HTMLImageElement;
  timestamp: number;
  assetId: string;
  filmstripUrl: string;
  accessCount: number;
  size: number; // Estimated memory size in bytes
}

interface CacheStats {
  size: number;
  maxSize: number;
  totalMemoryUsage: number;
  maxMemoryUsage: number;
  hitRate: number;
  totalRequests: number;
  cacheHits: number;
}

class FilmstripCache {
  private cache = new Map<string, FilmstripCacheEntry>();
  private maxCacheSize = 150; // Further increased cache size for enhanced filmstrips
  private maxAge = 15 * 60 * 1000; // 15 minutes in milliseconds for longer sessions
  private maxMemoryUsage = 75 * 1024 * 1024; // 75MB memory limit for larger filmstrips
  private totalMemoryUsage = 0;
  private totalRequests = 0;
  private cacheHits = 0;
  private preloadQueue = new Set<string>(); // Queue for preloading filmstrips

  // Get cached filmstrip image with enhanced tracking
  getImage(assetId: string, filmstripUrl: string): HTMLImageElement | null {
    this.totalRequests++;
    
    const entry = this.cache.get(assetId);
    
    if (!entry) {
      return null;
    }
    
    // Check if cache entry is still valid
    if (entry.filmstripUrl !== filmstripUrl || Date.now() - entry.timestamp > this.maxAge) {
      this.removeFromCache(assetId);
      return null;
    }
    
    // Update timestamp and access count for better LRU behavior
    entry.timestamp = Date.now();
    entry.accessCount++;
    this.cacheHits++;
    
    return entry.image;
  }

  // Cache a filmstrip image with memory management
  setImage(assetId: string, filmstripUrl: string, image: HTMLImageElement): void {
    // Estimate memory usage (rough calculation)
    const estimatedSize = this.estimateImageSize(image);
    
    // Clean up if we're approaching memory limits
    if (this.totalMemoryUsage + estimatedSize > this.maxMemoryUsage || 
        this.cache.size >= this.maxCacheSize) {
      this.cleanup();
    }

    // Remove existing entry if it exists
    if (this.cache.has(assetId)) {
      this.removeFromCache(assetId);
    }

    const entry: FilmstripCacheEntry = {
      image,
      timestamp: Date.now(),
      assetId,
      filmstripUrl,
      accessCount: 1,
      size: estimatedSize
    };

    this.cache.set(assetId, entry);
    this.totalMemoryUsage += estimatedSize;
  }

  // Load image with enhanced caching and error handling
  async loadImage(assetId: string, filmstripUrl: string): Promise<HTMLImageElement> {
    // Check cache first
    const cachedImage = this.getImage(assetId, filmstripUrl);
    if (cachedImage) {
      return cachedImage;
    }

    // Check if already loading to prevent duplicate requests
    const loadingKey = `loading_${assetId}`;
    if (this.preloadQueue.has(loadingKey)) {
      // Wait for existing load to complete with improved polling
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 600; // 60 seconds with 100ms intervals
        
        const checkLoaded = () => {
          attempts++;
          const cached = this.getImage(assetId, filmstripUrl);
          if (cached) {
            resolve(cached);
          } else if (!this.preloadQueue.has(loadingKey)) {
            // Loading completed but failed
            reject(new Error(`Failed to load filmstrip: ${filmstripUrl}`));
          } else if (attempts >= maxAttempts) {
            // Timeout waiting for other load
            this.preloadQueue.delete(loadingKey);
            reject(new Error(`Timeout waiting for filmstrip load: ${filmstripUrl}`));
          } else {
            // Still loading, check again
            setTimeout(checkLoaded, 100);
          }
        };
        setTimeout(checkLoaded, 100);
      });
    }

    // Mark as loading
    this.preloadQueue.add(loadingKey);

    // Load new image with enhanced timeout and retry logic
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      
      // Set up timeout with longer duration for larger filmstrips
      const timeout = setTimeout(() => {
        this.preloadQueue.delete(loadingKey);
        reject(new Error(`Filmstrip load timeout: ${filmstripUrl}`));
      }, 45000); // 45 second timeout for larger filmstrips
      
      img.onload = () => {
        clearTimeout(timeout);
        this.preloadQueue.delete(loadingKey);
        
        try {
          // Cache the loaded image
          this.setImage(assetId, filmstripUrl, img);
          resolve(img);
        } catch (error) {
          reject(new Error(`Failed to cache filmstrip: ${error}`));
        }
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        this.preloadQueue.delete(loadingKey);
        reject(new Error(`Failed to load filmstrip: ${filmstripUrl}`));
      };
      
      img.src = filmstripUrl;
    });
  }

  // Enhanced cleanup with memory-aware and access-based eviction
  private cleanup(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Calculate how many entries to remove
    const memoryPressure = this.totalMemoryUsage > this.maxMemoryUsage * 0.8;
    const sizePressure = this.cache.size > this.maxCacheSize * 0.8;
    
    if (!memoryPressure && !sizePressure) {
      // Only remove expired entries
      entries.forEach(([assetId, entry]) => {
        if (now - entry.timestamp > this.maxAge) {
          this.removeFromCache(assetId);
        }
      });
      return;
    }
    
    // Sort by priority: expired first, then by access pattern (LRU + access count)
    entries.sort((a, b) => {
      const [, entryA] = a;
      const [, entryB] = b;
      
      // Expired entries have lowest priority
      const expiredA = now - entryA.timestamp > this.maxAge;
      const expiredB = now - entryB.timestamp > this.maxAge;
      
      if (expiredA && !expiredB) return -1;
      if (!expiredA && expiredB) return 1;
      
      // For non-expired entries, use weighted score
      const scoreA = entryA.accessCount * 0.3 + (now - entryA.timestamp) * -0.7;
      const scoreB = entryB.accessCount * 0.3 + (now - entryB.timestamp) * -0.7;
      
      return scoreA - scoreB; // Lower score = higher priority for removal
    });
    
    // Remove entries until we're under limits
    const targetSize = Math.floor(this.maxCacheSize * 0.7); // Remove to 70% capacity
    const targetMemory = Math.floor(this.maxMemoryUsage * 0.7);
    
    let removed = 0;
    for (const [assetId] of entries) {
      if (this.cache.size <= targetSize && this.totalMemoryUsage <= targetMemory) {
        break;
      }
      
      this.removeFromCache(assetId);
      removed++;
      
      // Safety check to prevent infinite loop
      if (removed > entries.length * 0.5) {
        break;
      }
    }
    
    // Log cleanup for debugging
    if (import.meta.env.DEV && removed > 0) {
      console.log(`FilmstripCache: Cleaned up ${removed} entries. Size: ${this.cache.size}/${this.maxCacheSize}, Memory: ${Math.round(this.totalMemoryUsage / 1024 / 1024)}MB/${Math.round(this.maxMemoryUsage / 1024 / 1024)}MB`);
    }
  }

  // Enhanced cleanup for performance critical situations
  performCriticalCleanup(): void {
    console.log('FilmstripCache: Performing critical cleanup');
    
    // More aggressive cleanup - remove 80% of entries
    const entries = Array.from(this.cache.entries());
    // const now = Date.now();
    
    // Sort by access time (oldest first)
    entries.sort((a, b) => {
      const [, entryA] = a;
      const [, entryB] = b;
      return entryA.timestamp - entryB.timestamp;
    });
    
    const toRemove = Math.floor(entries.length * 0.8);
    
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      const [assetId] = entries[i];
      this.removeFromCache(assetId);
    }
    
    console.log(`FilmstripCache: Critical cleanup removed ${toRemove} entries. Remaining: ${this.cache.size}`);
  }

  // Remove entry from cache and update memory usage
  private removeFromCache(assetId: string): void {
    const entry = this.cache.get(assetId);
    if (entry) {
      this.totalMemoryUsage -= entry.size;
      this.cache.delete(assetId);
    }
  }

  // Estimate image memory usage (enhanced calculation for filmstrips)
  private estimateImageSize(image: HTMLImageElement): number {
    // Enhanced estimate for filmstrip images which are typically larger
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    
    // Account for RGBA channels (4 bytes per pixel) plus compression overhead
    const pixelData = width * height * 4;
    
    // Add overhead for image object, canvas buffers, and browser optimizations
    const baseOverhead = 2048; // 2KB base overhead
    const sizeBasedOverhead = Math.floor(pixelData * 0.1); // 10% overhead for large images
    
    return pixelData + baseOverhead + sizeBasedOverhead;
  }

  // Clear all cached images
  clear(): void {
    this.cache.clear();
    this.totalMemoryUsage = 0;
    this.preloadQueue.clear();
    this.totalRequests = 0;
    this.cacheHits = 0;
  }

  // Get comprehensive cache statistics
  getStats(): CacheStats {
    const hitRate = this.totalRequests > 0 ? (this.cacheHits / this.totalRequests) * 100 : 0;
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      totalMemoryUsage: this.totalMemoryUsage,
      maxMemoryUsage: this.maxMemoryUsage,
      hitRate: Math.round(hitRate * 100) / 100,
      totalRequests: this.totalRequests,
      cacheHits: this.cacheHits
    };
  }

  // Preload filmstrips for better user experience
  async preloadFilmstrip(assetId: string, filmstripUrl: string): Promise<void> {
    try {
      // Only preload if not already cached or loading
      if (!this.getImage(assetId, filmstripUrl) && !this.preloadQueue.has(`loading_${assetId}`)) {
        await this.loadImage(assetId, filmstripUrl);
      }
    } catch (error) {
      // Silently fail preloading - it's not critical
      console.debug(`Preload failed for ${assetId}:`, error);
    }
  }

  // Batch preload multiple filmstrips
  async preloadBatch(items: Array<{ assetId: string; filmstripUrl: string }>): Promise<void> {
    const preloadPromises = items.map(({ assetId, filmstripUrl }) => 
      this.preloadFilmstrip(assetId, filmstripUrl)
    );
    
    // Use Promise.allSettled to not fail the entire batch if one fails
    await Promise.allSettled(preloadPromises);
  }
}

// Create singleton instance
export const filmstripCache = new FilmstripCache();

// Cleanup on page unload and performance events
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    filmstripCache.clear();
  });

  // Listen for performance cleanup events
  window.addEventListener('performance:memoryCleanup', (event: Event) => {
    const { severity } = (event as CustomEvent).detail;
    
    if (severity === 'critical') {
      filmstripCache.performCriticalCleanup();
    } else if (severity === 'warning') {
      // Trigger regular cleanup
      (filmstripCache as any).cleanup();
    }
  });
}