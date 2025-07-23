import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  initializePersistence, 
  saveProject, 
  restoreProject,
  resetInitializationState
} from '../useAetherStore';
import { AetherProjectType } from '@aether-editor/types';

// Mock the persistence utilities
vi.mock('../../utils/persistence', () => ({
  saveProjectToDB: vi.fn(),
  loadProjectFromDB: vi.fn(),
  isIndexedDBSupported: vi.fn(() => true)
}));

// Import the mocked functions
import { 
  saveProjectToDB, 
  loadProjectFromDB, 
  isIndexedDBSupported 
} from '../../utils/persistence';

const mockSaveProjectToDB = vi.mocked(saveProjectToDB);
const mockLoadProjectFromDB = vi.mocked(loadProjectFromDB);
const mockIsIndexedDBSupported = vi.mocked(isIndexedDBSupported);

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Create a sample project for testing
const createSampleProject = (): AetherProjectType => ({
  projectSettings: {
    name: 'Test Project',
    resolution: '1080p',
    fps: 30,
    duration: 60
  },
  assetLibrary: [
    {
      assetId: 'asset-1',
      fileName: 'test-image.jpg',
      type: 'image',
      sourceUrl: '/uploads/test-image.jpg',
      thumbnailUrl: '/uploads/test-image-thumb.jpg',
      isPlaceholder: false
    }
  ],
  timeline: {
    videoTracks: [[
      {
        clipId: 'clip-1',
        assetId: 'asset-1',
        startTime: 0,
        duration: 5,
        volume: 1,
        textOverlays: []
      }
    ]],
    audioTracks: [[]]
  },
  selectedClipId: null,
  selectedClipIds: [],
  currentTime: 0,
  isPlaying: false,
  timelineScale: 50
});

describe('Store Persistence Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    // Reset the initialization state for each test
    resetInitializationState();
    mockIsIndexedDBSupported.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializePersistence', () => {
    it('should initialize persistence and restore saved project', async () => {
      const sampleProject = createSampleProject();
      mockLoadProjectFromDB.mockResolvedValue(sampleProject);

      await initializePersistence();

      expect(mockLoadProjectFromDB).toHaveBeenCalled();
    });

    it('should initialize without restoring when no saved project exists', async () => {
      mockLoadProjectFromDB.mockResolvedValue(null);

      await initializePersistence();

      expect(mockLoadProjectFromDB).toHaveBeenCalled();
    });

    it('should handle initialization errors gracefully', async () => {
      mockLoadProjectFromDB.mockRejectedValue(new Error('DB Error'));

      // Should not throw, just handle gracefully
      await expect(initializePersistence()).resolves.toBeUndefined();
    });

    it('should not initialize when IndexedDB is not supported', async () => {
      mockIsIndexedDBSupported.mockReturnValue(false);

      await initializePersistence();

      expect(mockLoadProjectFromDB).not.toHaveBeenCalled();
    });
  });

  describe('saveProject', () => {
    it('should save project manually', async () => {
      mockSaveProjectToDB.mockResolvedValue(undefined);

      await saveProject();

      expect(mockSaveProjectToDB).toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      mockSaveProjectToDB.mockRejectedValue(new Error('Save failed'));

      await expect(saveProject()).rejects.toThrow('Save failed');
    });

    it('should throw error when IndexedDB is not supported', async () => {
      mockIsIndexedDBSupported.mockReturnValue(false);

      await expect(saveProject()).rejects.toThrow('Local storage not supported');
    });
  });

  describe('restoreProject', () => {
    it('should restore project successfully', async () => {
      const sampleProject = createSampleProject();
      mockLoadProjectFromDB.mockResolvedValue(sampleProject);

      const result = await restoreProject();

      expect(result).toBe(true);
      expect(mockLoadProjectFromDB).toHaveBeenCalled();
    });

    it('should return false when no project found', async () => {
      mockLoadProjectFromDB.mockResolvedValue(null);

      const result = await restoreProject();

      expect(result).toBe(false);
    });

    it('should handle restore errors', async () => {
      mockLoadProjectFromDB.mockRejectedValue(new Error('Load failed'));

      const result = await restoreProject();

      expect(result).toBe(false);
    });

    it('should return false when IndexedDB is not supported', async () => {
      mockIsIndexedDBSupported.mockReturnValue(false);

      const result = await restoreProject();

      expect(result).toBe(false);
    });

    it('should restore specific project by ID', async () => {
      const sampleProject = createSampleProject();
      mockLoadProjectFromDB.mockResolvedValue(sampleProject);

      const result = await restoreProject('specific-project-id');

      expect(result).toBe(true);
      expect(mockLoadProjectFromDB).toHaveBeenCalledWith('specific-project-id');
    });
  });
});