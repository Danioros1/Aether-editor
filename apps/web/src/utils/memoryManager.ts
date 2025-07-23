// Enhanced memory management system
import { performanceMonitor } from './performanceMonitor';
import { isTestEnvironment } from './testEnvironment';

export interface MemoryUsageReport {
  timestamp: Date;
  totalMemory: number; // MB
  usedMemory: number; // MB
  availableMemory: number; // MB
  memoryPressure: 'low' | 'medium' | 'high' | 'critical';
  breakdown: {
    textures: number;
    audioBuffers: number;
    videoBuffers: number;
    thumbnails: number;
    filmstrips: number;
    other: number;
  };
  recommendations: string[];
}

export interface MemoryCleanupResult {
  freedMemory: number; // MB
  itemsCleared: number;
  categories: string[];
  success: boolean;
  error?: string;
}

interface MemoryTracker {
  category: string;
  items: Map<string, { size: number; lastAccessed: Date; priority: number }>;
  maxSize: number; // MB
  currentSize: number; // MB
}

class MemoryManager {
  private trackers = new Map<string, MemoryTracker>();
  private cleanupCallbacks = new Map<string, () => Promise<number>>();
  private memoryHistory: MemoryUsageReport[] = [];
  private isMonitoring = false;
  private monitoringInterval: number | null = null;
  private lastCleanupTime = 0;
  private cleanupThreshold = 0.8; // Trigger cleanup at 80% memory usage
  private criticalThreshold = 0.9; // Critical memory usage threshold

  constructor() {
    this.initializeTrackers();
    this.setupEventListeners();
  }

  // Initialize memory trackers for different categories
  private initializeTrackers(): void {
    const trackerConfigs = [
      { category: 'textures', maxSize: 100 }, // 100MB for textures
      { category: 'audioBuffers', maxSize: 50 }, // 50MB for audio
      { category: 'videoBuffers', maxSize: 200 }, // 200MB for video
      { category: 'thumbnails', maxSize: 30 }, // 30MB for thumbnails
      { category: 'filmstrips', maxSize: 80 }, // 80MB for filmstrips
      { category: 'other', maxSize: 40 }, // 40MB for other data
    ];

    trackerConfigs.forEach(config => {
      this.trackers.set(config.category, {
        category: config.category,
        items: new Map(),
        maxSize: config.maxSize,
        currentSize: 0,
      });
    });
  }

  // Setup event listeners for performance events
  private setupEventListeners(): void {
    // Listen for memory cleanup requests
    window.addEventListener('performance:memoryCleanup', this.handleMemoryCleanupRequest.bind(this) as any);
    window.addEventListener('performance:clearCaches', this.handleClearCaches.bind(this) as any);
    
    // Listen for page visibility changes to trigger cleanup
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.performBackgroundCleanup();
      }
    });

    // Listen for low memory warnings (if supported)
    if ('memory' in navigator && 'addEventListener' in (navigator as any).memory) {
      (navigator as any).memory.addEventListener('memorywarning', () => {
        this.handleLowMemoryWarning();
      });
    }
  }

  // Start memory monitoring
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      this.updateMemoryReport();
      this.checkMemoryPressure();
    }, 3000); // Check every 3 seconds

    console.log('Memory manager monitoring started');
  }

  // Stop memory monitoring
  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('Memory manager monitoring stopped');
  }

  // Track memory usage for a specific item
  trackMemoryUsage(category: string, itemId: string, sizeBytes: number, priority: number = 1): void {
    const tracker = this.trackers.get(category);
    if (!tracker) {
      console.warn(`Unknown memory category: ${category}`);
      return;
    }

    const sizeMB = sizeBytes / (1024 * 1024);
    const existingItem = tracker.items.get(itemId);
    
    if (existingItem) {
      // Update existing item
      tracker.currentSize -= existingItem.size;
      tracker.currentSize += sizeMB;
      existingItem.size = sizeMB;
      existingItem.lastAccessed = new Date();
      existingItem.priority = priority;
    } else {
      // Add new item
      tracker.items.set(itemId, {
        size: sizeMB,
        lastAccessed: new Date(),
        priority,
      });
      tracker.currentSize += sizeMB;
    }

    // Check if category is over limit
    if (tracker.currentSize > tracker.maxSize) {
      this.cleanupCategory(category);
    }
  }

  // Remove tracked memory usage
  untrackMemoryUsage(category: string, itemId: string): void {
    const tracker = this.trackers.get(category);
    if (!tracker) return;

    const item = tracker.items.get(itemId);
    if (item) {
      tracker.currentSize -= item.size;
      tracker.items.delete(itemId);
    }
  }

  // Update last accessed time for an item
  touchMemoryItem(category: string, itemId: string): void {
    const tracker = this.trackers.get(category);
    if (!tracker) return;

    const item = tracker.items.get(itemId);
    if (item) {
      item.lastAccessed = new Date();
    }
  }

  // Register cleanup callback for a category
  registerCleanupCallback(category: string, callback: () => Promise<number>): void {
    this.cleanupCallbacks.set(category, callback);
  }

  // Get current memory usage report
  getMemoryReport(): MemoryUsageReport {
    const memoryInfo = this.getMemoryInfo();
    const breakdown = this.getMemoryBreakdown();
    const memoryPressure = this.calculateMemoryPressure(memoryInfo.usedMemory, memoryInfo.totalMemory);
    
    return {
      timestamp: new Date(),
      totalMemory: memoryInfo.totalMemory,
      usedMemory: memoryInfo.usedMemory,
      availableMemory: memoryInfo.availableMemory,
      memoryPressure,
      breakdown,
      recommendations: this.generateRecommendations(memoryPressure, breakdown),
    };
  }

  // Get memory information from browser APIs
  private getMemoryInfo(): { totalMemory: number; usedMemory: number; availableMemory: number } {
    if (isTestEnvironment()) {
      // Return mock data for tests
      return {
        totalMemory: 2048, // 2GB
        usedMemory: 512, // 512MB
        availableMemory: 1536, // 1.5GB
      };
    }

    try {
      const memory = (performance as any).memory;
      if (memory) {
        const totalMemory = memory.jsHeapSizeLimit / (1024 * 1024);
        const usedMemory = memory.usedJSHeapSize / (1024 * 1024);
        const availableMemory = totalMemory - usedMemory;
        
        return { totalMemory, usedMemory, availableMemory };
      }
    } catch (error) {
      console.warn('Unable to get memory info:', error);
    }

    // Fallback estimates
    return {
      totalMemory: 2048, // 2GB estimate
      usedMemory: performanceMonitor.getMemoryUsageMB(),
      availableMemory: 1536, // 1.5GB estimate
    };
  }

  // Get memory breakdown by category
  private getMemoryBreakdown(): MemoryUsageReport['breakdown'] {
    const breakdown = {
      textures: 0,
      audioBuffers: 0,
      videoBuffers: 0,
      thumbnails: 0,
      filmstrips: 0,
      other: 0,
    };

    this.trackers.forEach((tracker, category) => {
      if (category in breakdown) {
        (breakdown as any)[category] = tracker.currentSize;
      } else {
        breakdown.other += tracker.currentSize;
      }
    });

    return breakdown;
  }

  // Calculate memory pressure level
  private calculateMemoryPressure(usedMemory: number, totalMemory: number): MemoryUsageReport['memoryPressure'] {
    const usage = usedMemory / totalMemory;
    
    if (usage > this.criticalThreshold) return 'critical';
    if (usage > this.cleanupThreshold) return 'high';
    if (usage > 0.6) return 'medium';
    return 'low';
  }

  // Generate memory optimization recommendations
  private generateRecommendations(pressure: MemoryUsageReport['memoryPressure'], breakdown: MemoryUsageReport['breakdown']): string[] {
    const recommendations: string[] = [];

    if (pressure === 'critical') {
      recommendations.push('Critical memory usage detected. Consider closing other browser tabs.');
      recommendations.push('Switch to minimal performance mode to reduce memory usage.');
    } else if (pressure === 'high') {
      recommendations.push('High memory usage. Performance optimizations have been applied.');
    }

    // Category-specific recommendations
    if (breakdown.textures > 50) {
      recommendations.push('High texture memory usage. Consider reducing preview quality.');
    }
    if (breakdown.videoBuffers > 100) {
      recommendations.push('High video buffer usage. Consider limiting concurrent video processing.');
    }
    if (breakdown.filmstrips > 40) {
      recommendations.push('High filmstrip cache usage. Older filmstrips will be cleared automatically.');
    }

    return recommendations;
  }

  // Update memory report and history
  private updateMemoryReport(): void {
    const report = this.getMemoryReport();
    this.memoryHistory.push(report);

    // Limit history size
    if (this.memoryHistory.length > 100) {
      this.memoryHistory = this.memoryHistory.slice(-100);
    }

    // Dispatch memory report event
    window.dispatchEvent(new CustomEvent('memory:report', {
      detail: report
    }));
  }

  // Check memory pressure and trigger cleanup if needed
  private checkMemoryPressure(): void {
    const report = this.getMemoryReport();
    
    if (report.memoryPressure === 'critical') {
      this.performAggressiveCleanup();
    } else if (report.memoryPressure === 'high') {
      this.performStandardCleanup();
    }
  }

  // Handle memory cleanup requests
  private async handleMemoryCleanupRequest(event: CustomEvent): Promise<void> {
    const { severity } = event.detail;
    
    if (severity === 'critical') {
      await this.performAggressiveCleanup();
    } else {
      await this.performStandardCleanup();
    }
  }

  // Handle cache clearing requests
  private async handleClearCaches(event: CustomEvent): Promise<void> {
    const { aggressive } = event.detail;
    
    if (aggressive) {
      await this.clearAllCaches();
    } else {
      await this.clearOldCaches();
    }
  }

  // Perform standard memory cleanup
  async performStandardCleanup(): Promise<MemoryCleanupResult> {
    const startMemory = this.getMemoryInfo().usedMemory;
    let totalFreed = 0;
    let totalItems = 0;
    const categories: string[] = [];

    try {
      // Clean up each category based on LRU and priority
      for (const [category, tracker] of this.trackers) {
        if (tracker.currentSize > tracker.maxSize * 0.8) {
          const freed = await this.cleanupCategory(category);
          if (freed > 0) {
            totalFreed += freed;
            categories.push(category);
          }
        }
      }

      // Force garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc();
      }

      const endMemory = this.getMemoryInfo().usedMemory;
      const actualFreed = Math.max(0, startMemory - endMemory);

      return {
        freedMemory: actualFreed,
        itemsCleared: totalItems,
        categories,
        success: true,
      };
    } catch (error) {
      return {
        freedMemory: 0,
        itemsCleared: 0,
        categories: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Perform aggressive memory cleanup
  async performAggressiveCleanup(): Promise<MemoryCleanupResult> {
    const startMemory = this.getMemoryInfo().usedMemory;
    let totalFreed = 0;
    let totalItems = 0;
    const categories: string[] = [];

    try {
      // Clear all caches aggressively
      for (const [category] of this.trackers) {
        const freed = await this.cleanupCategory(category, true);
        if (freed > 0) {
          totalFreed += freed;
          categories.push(category);
        }
      }

      // Clear browser caches if possible
      await this.clearBrowserCaches();

      // Force multiple garbage collections
      if ('gc' in window && typeof (window as any).gc === 'function') {
        for (let i = 0; i < 3; i++) {
          (window as any).gc();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      const endMemory = this.getMemoryInfo().usedMemory;
      const actualFreed = Math.max(0, startMemory - endMemory);

      return {
        freedMemory: actualFreed,
        itemsCleared: totalItems,
        categories,
        success: true,
      };
    } catch (error) {
      return {
        freedMemory: 0,
        itemsCleared: 0,
        categories: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Clean up a specific category
  private async cleanupCategory(category: string, aggressive: boolean = false): Promise<number> {
    const tracker = this.trackers.get(category);
    if (!tracker) return 0;

    const callback = this.cleanupCallbacks.get(category);
    let freedMemory = 0;

    if (callback) {
      try {
        freedMemory = await callback();
      } catch (error) {
        console.warn(`Cleanup callback failed for ${category}:`, error);
      }
    }

    // Clean up tracked items using LRU strategy
    const items = Array.from(tracker.items.entries());
    const targetSize = aggressive ? tracker.maxSize * 0.3 : tracker.maxSize * 0.7;
    
    if (tracker.currentSize > targetSize) {
      // Sort by last accessed time and priority (older and lower priority first)
      items.sort(([, a], [, b]) => {
        const timeDiff = a.lastAccessed.getTime() - b.lastAccessed.getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.priority - b.priority;
      });

      let currentSize = tracker.currentSize;
      for (const [itemId, item] of items) {
        if (currentSize <= targetSize) break;
        
        tracker.items.delete(itemId);
        currentSize -= item.size;
        freedMemory += item.size;
        
        // Notify about item removal
        window.dispatchEvent(new CustomEvent('memory:itemRemoved', {
          detail: { category, itemId, size: item.size }
        }));
      }
      
      tracker.currentSize = currentSize;
    }

    return freedMemory;
  }

  // Clear all caches
  private async clearAllCaches(): Promise<void> {
    for (const tracker of this.trackers.values()) {
      tracker.items.clear();
      tracker.currentSize = 0;
    }

    // Clear browser caches
    await this.clearBrowserCaches();
  }

  // Clear old caches (items not accessed recently)
  private async clearOldCaches(): Promise<void> {
    const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago

    for (const tracker of this.trackers.values()) {
      const itemsToRemove: string[] = [];
      
      for (const [itemId, item] of tracker.items) {
        if (item.lastAccessed < cutoffTime) {
          itemsToRemove.push(itemId);
          tracker.currentSize -= item.size;
        }
      }
      
      itemsToRemove.forEach(itemId => tracker.items.delete(itemId));
    }
  }

  // Clear browser caches if possible
  private async clearBrowserCaches(): Promise<void> {
    try {
      // Clear cache storage if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
    } catch (error) {
      console.warn('Failed to clear browser caches:', error);
    }
  }

  // Handle low memory warning
  private handleLowMemoryWarning(): void {
    console.warn('Low memory warning received');
    this.performAggressiveCleanup();
  }

  // Perform background cleanup when page is hidden
  private performBackgroundCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanupTime > 30000) { // 30 seconds since last cleanup
      this.lastCleanupTime = now;
      this.performStandardCleanup();
    }
  }

  // Get memory history
  getMemoryHistory(): MemoryUsageReport[] {
    return [...this.memoryHistory];
  }

  // Get memory statistics
  getMemoryStats(): {
    totalTracked: number;
    categoryStats: Array<{
      category: string;
      currentSize: number;
      maxSize: number;
      itemCount: number;
      utilizationPercent: number;
    }>;
  } {
    const categoryStats = Array.from(this.trackers.entries()).map(([category, tracker]) => ({
      category,
      currentSize: tracker.currentSize,
      maxSize: tracker.maxSize,
      itemCount: tracker.items.size,
      utilizationPercent: (tracker.currentSize / tracker.maxSize) * 100,
    }));

    const totalTracked = categoryStats.reduce((sum, stat) => sum + stat.currentSize, 0);

    return {
      totalTracked,
      categoryStats,
    };
  }
}

// Create singleton instance
export const memoryManager = new MemoryManager();

// Auto-start monitoring in development
if (import.meta.env.DEV) {
  memoryManager.startMonitoring();
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    memoryManager.stopMonitoring();
  });
}