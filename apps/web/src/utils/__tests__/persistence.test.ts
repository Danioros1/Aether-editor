import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  saveProjectToDB, 
  loadProjectFromDB, 
  getAllProjects, 
  deleteProjectFromDB, 
  clearAllProjects,
  isIndexedDBSupported 
} from '../persistence';
import { AetherProjectType } from '@aether-editor/types';

// Create mock database instance
const mockDB = {
  put: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn()
};

// Mock the idb library
vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB))
}));

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

describe('Persistence Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('isIndexedDBSupported', () => {
    it('should return true when IndexedDB is available', () => {
      // Mock window.indexedDB
      Object.defineProperty(window, 'indexedDB', {
        value: {},
        writable: true
      });
      
      expect(isIndexedDBSupported()).toBe(true);
    });

    it('should return false when IndexedDB is not available', () => {
      // Mock window without indexedDB
      const originalWindow = (globalThis as any).window;
      (globalThis as any).window = {} as any;
      
      expect(isIndexedDBSupported()).toBe(false);
      
      // Restore original window
      (globalThis as any).window = originalWindow;
    });
  });

  describe('saveProjectToDB', () => {
    it('should save project successfully', async () => {
      const sampleProject = createSampleProject();
      mockDB.get.mockResolvedValue(null); // No existing project
      mockDB.put.mockResolvedValue(undefined);

      await saveProjectToDB(sampleProject);

      expect(mockDB.put).toHaveBeenCalledWith('projects', expect.objectContaining({
        projectId: 'current-project',
        projectName: 'Test Project',
        projectData: sampleProject,
        lastModified: expect.any(Number),
        createdAt: expect.any(Number)
      }));
    });

    it('should update existing project with preserved createdAt', async () => {
      const sampleProject = createSampleProject();
      const existingCreatedAt = Date.now() - 10000;
      
      mockDB.get.mockResolvedValue({
        projectId: 'current-project',
        createdAt: existingCreatedAt
      });
      mockDB.put.mockResolvedValue(undefined);

      await saveProjectToDB(sampleProject);

      expect(mockDB.put).toHaveBeenCalledWith('projects', expect.objectContaining({
        createdAt: existingCreatedAt,
        lastModified: expect.any(Number)
      }));
    });

    it('should handle save errors', async () => {
      const sampleProject = createSampleProject();
      mockDB.get.mockRejectedValue(new Error('DB Error'));

      await expect(saveProjectToDB(sampleProject)).rejects.toThrow('Failed to save project to local storage');
    });
  });

  describe('loadProjectFromDB', () => {
    it('should load project successfully', async () => {
      const sampleProject = createSampleProject();
      const projectRecord = {
        projectId: 'current-project',
        projectName: 'Test Project',
        projectData: sampleProject,
        lastModified: Date.now(),
        createdAt: Date.now() - 1000
      };

      mockDB.get.mockResolvedValue(projectRecord);

      const result = await loadProjectFromDB();

      expect(result).toEqual(sampleProject);
      expect(mockDB.get).toHaveBeenCalledWith('projects', 'current-project');
    });

    it('should return null when project not found', async () => {
      mockDB.get.mockResolvedValue(undefined);

      const result = await loadProjectFromDB();

      expect(result).toBeNull();
    });

    it('should handle load errors', async () => {
      mockDB.get.mockRejectedValue(new Error('DB Error'));

      await expect(loadProjectFromDB()).rejects.toThrow('Failed to load project from local storage');
    });
  });

  describe('getAllProjects', () => {
    it('should return all projects sorted by lastModified', async () => {
      const projects = [
        {
          projectId: 'project-1',
          projectName: 'Project 1',
          projectData: createSampleProject(),
          lastModified: 1000,
          createdAt: 500
        },
        {
          projectId: 'project-2',
          projectName: 'Project 2',
          projectData: createSampleProject(),
          lastModified: 2000,
          createdAt: 1500
        }
      ];

      mockDB.getAll.mockResolvedValue(projects);

      const result = await getAllProjects();

      expect(result).toEqual([
        {
          projectId: 'project-2',
          projectName: 'Project 2',
          lastModified: 2000,
          createdAt: 1500
        },
        {
          projectId: 'project-1',
          projectName: 'Project 1',
          lastModified: 1000,
          createdAt: 500
        }
      ]);
    });

    it('should return empty array on error', async () => {
      mockDB.getAll.mockRejectedValue(new Error('DB Error'));

      const result = await getAllProjects();

      expect(result).toEqual([]);
    });
  });

  describe('deleteProjectFromDB', () => {
    it('should delete project successfully', async () => {
      mockDB.delete.mockResolvedValue(undefined);

      await deleteProjectFromDB('test-project');

      expect(mockDB.delete).toHaveBeenCalledWith('projects', 'test-project');
    });

    it('should handle delete errors', async () => {
      mockDB.delete.mockRejectedValue(new Error('DB Error'));

      await expect(deleteProjectFromDB('test-project')).rejects.toThrow('Failed to delete project from local storage');
    });
  });

  describe('clearAllProjects', () => {
    it('should clear all projects successfully', async () => {
      mockDB.clear.mockResolvedValue(undefined);

      await clearAllProjects();

      expect(mockDB.clear).toHaveBeenCalledWith('projects');
    });

    it('should handle clear errors', async () => {
      mockDB.clear.mockRejectedValue(new Error('DB Error'));

      await expect(clearAllProjects()).rejects.toThrow('Failed to clear local storage');
    });
  });
});