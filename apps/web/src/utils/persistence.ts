import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { AetherProjectType } from '@aether-editor/types';

// Define the database schema
interface AetherEditorDB extends DBSchema {
  projects: {
    key: string;
    value: {
      projectId: string;
      projectName: string;
      projectData: AetherProjectType;
      lastModified: number;
      createdAt: number;
    };
    indexes: {
      'by-lastModified': number;
      'by-projectName': string;
    };
  };
}

// Database configuration
const DB_NAME = 'aether-editor';
const DB_VERSION = 1;
const CURRENT_PROJECT_KEY = 'current-project';

let dbInstance: IDBPDatabase<AetherEditorDB> | null = null;

// Initialize the database
export async function initDB(): Promise<IDBPDatabase<AetherEditorDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  try {
    dbInstance = await openDB<AetherEditorDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create the projects object store
        const projectStore = db.createObjectStore('projects', {
          keyPath: 'projectId'
        });

        // Create indexes for efficient querying
        projectStore.createIndex('by-lastModified', 'lastModified');
        projectStore.createIndex('by-projectName', 'projectName');
      },
    });

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize IndexedDB:', error);
    throw new Error('Failed to initialize local storage');
  }
}

// Save project to IndexedDB
export async function saveProjectToDB(
  projectData: AetherProjectType,
  projectId: string = CURRENT_PROJECT_KEY
): Promise<void> {
  try {
    const db = await initDB();
    const now = Date.now();

    // Check if project already exists to determine if it's an update
    const existingProject = await db.get('projects', projectId);
    const createdAt = existingProject?.createdAt || now;

    const projectRecord = {
      projectId,
      projectName: projectData.projectSettings.name,
      projectData,
      lastModified: now,
      createdAt
    };

    await db.put('projects', projectRecord);
    console.log(`Project "${projectData.projectSettings.name}" saved successfully`);
  } catch (error) {
    console.error('Failed to save project to IndexedDB:', error);
    throw new Error('Failed to save project to local storage');
  }
}

// Load project from IndexedDB
export async function loadProjectFromDB(
  projectId: string = CURRENT_PROJECT_KEY
): Promise<AetherProjectType | null> {
  try {
    const db = await initDB();
    const projectRecord = await db.get('projects', projectId);

    if (!projectRecord) {
      console.log(`No project found with ID: ${projectId}`);
      return null;
    }

    console.log(`Project "${projectRecord.projectName}" loaded successfully`);
    return projectRecord.projectData;
  } catch (error) {
    console.error('Failed to load project from IndexedDB:', error);
    throw new Error('Failed to load project from local storage');
  }
}

// Get all saved projects (for future project management features)
export async function getAllProjects(): Promise<Array<{
  projectId: string;
  projectName: string;
  lastModified: number;
  createdAt: number;
}>> {
  try {
    const db = await initDB();
    const projects = await db.getAll('projects');

    return projects
      .map(project => ({
        projectId: project.projectId,
        projectName: project.projectName,
        lastModified: project.lastModified,
        createdAt: project.createdAt
      }))
      .sort((a, b) => b.lastModified - a.lastModified); // Sort by most recent first
  } catch (error) {
    console.error('Failed to get all projects:', error);
    return [];
  }
}

// Delete a project from IndexedDB
export async function deleteProjectFromDB(projectId: string): Promise<void> {
  try {
    const db = await initDB();
    await db.delete('projects', projectId);
    console.log(`Project with ID "${projectId}" deleted successfully`);
  } catch (error) {
    console.error('Failed to delete project:', error);
    throw new Error('Failed to delete project from local storage');
  }
}

// Clear all projects (for testing or reset purposes)
export async function clearAllProjects(): Promise<void> {
  try {
    const db = await initDB();
    await db.clear('projects');
    console.log('All projects cleared from local storage');
  } catch (error) {
    console.error('Failed to clear all projects:', error);
    throw new Error('Failed to clear local storage');
  }
}

// Check if IndexedDB is supported
export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}