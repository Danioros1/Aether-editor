import React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { temporal } from 'zundo';
import { 
  AetherProjectType, 
  AssetType, 
  ClipType, 
  PartialAssetType, 
  PartialClipType 
} from '@aether-editor/types';
import { 
  saveProjectToDB, 
  loadProjectFromDB, 
  isIndexedDBSupported 
} from '../utils/persistence';

// Define the store interface extending the project type with actions
interface AetherEditorState extends AetherProjectType {
  // Asset management actions
  addAsset: (asset: AssetType) => void;
  updateAsset: (assetId: string, updates: PartialAssetType) => void;
  removeAsset: (assetId: string) => void;
  
  // Timeline and clip management actions
  addClipToTimeline: (asset: AssetType, startTime: number, trackType?: 'video' | 'audio', trackIndex?: number) => void;
  updateClipProperties: (clipId: string, updates: PartialClipType) => void;
  removeClip: (clipId: string) => void;
  splitClip: (clipId: string, splitTime: number) => void;
  
  // Selection and playback actions
  setSelectedClipId: (id: string | null) => void;
  setSelectedClipIds: (ids: string[]) => void;
  addToSelection: (clipId: string) => void;
  removeFromSelection: (clipId: string) => void;
  toggleSelection: (clipId: string) => void;
  clearSelection: () => void;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setTimelineScale: (scale: number) => void;
  
  // Batch operations for multi-select
  deleteSelectedClips: () => void;
  moveSelectedClips: (deltaTime: number) => void;
  updateSelectedClipsProperties: (updates: PartialClipType) => void;
  
  // Project management actions
  loadProject: (project: AetherProjectType) => void;
  resetProject: () => void;
}

// Create default empty project state
const createDefaultProject = (): AetherProjectType => ({
  projectSettings: {
    name: 'Untitled Project',
    resolution: '1080p',
    fps: 30,
    duration: 60 // Default 60 seconds
  },
  assetLibrary: [],
  timeline: {
    videoTracks: [[]],
    audioTracks: [[]]
  },
  selectedClipId: null,
  selectedClipIds: [],
  currentTime: 0,
  isPlaying: false,
  timelineScale: 50
});

// Generate unique IDs
const generateId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Debounced save function
let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 500; // 500ms debounce

const debouncedSave = (projectData: AetherProjectType) => {
  if (!isIndexedDBSupported()) {
    console.warn('IndexedDB not supported, skipping auto-save');
    return;
  }

  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(async () => {
    try {
      await saveProjectToDB(projectData);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, SAVE_DEBOUNCE_MS);
};

// Create the Zustand store with temporal middleware for undo/redo
export const useAetherStore = create<AetherEditorState>()(
  subscribeWithSelector(
    temporal((set) => ({
      // Initialize with default project state
      ...createDefaultProject(),
      
      // Asset management actions
      addAsset: (asset: AssetType) => {
        set((state) => ({
          assetLibrary: [...state.assetLibrary, asset]
        }));
      },
      
      updateAsset: (assetId: string, updates: PartialAssetType) => {
        set((state) => ({
          assetLibrary: state.assetLibrary.map(asset =>
            asset.assetId === assetId ? { ...asset, ...updates } : asset
          )
        }));
      },
      
      removeAsset: (assetId: string) => {
        set((state) => ({
          assetLibrary: state.assetLibrary.filter(asset => asset.assetId !== assetId)
        }));
      },
      
      // Timeline and clip management actions
      addClipToTimeline: (asset: AssetType, startTime: number, trackType: 'video' | 'audio' = 'video', trackIndex: number = 0) => {
        const newClip: ClipType = {
          clipId: generateId(),
          assetId: asset.assetId,
          startTime,
          duration: asset.duration || 5, // Default 5 seconds if no duration
          volume: 1,
          textOverlays: []
        };
        
        set((state) => {
          const newTimeline = { ...state.timeline };
          
          if (trackType === 'video') {
            // Ensure video track exists
            while (newTimeline.videoTracks.length <= trackIndex) {
              newTimeline.videoTracks.push([]);
            }
            newTimeline.videoTracks[trackIndex] = [...newTimeline.videoTracks[trackIndex], newClip];
          } else {
            // Ensure audio track exists
            while (newTimeline.audioTracks.length <= trackIndex) {
              newTimeline.audioTracks.push([]);
            }
            newTimeline.audioTracks[trackIndex] = [...newTimeline.audioTracks[trackIndex], newClip];
          }
          
          return { timeline: newTimeline };
        });
      },
      
      updateClipProperties: (clipId: string, updates: PartialClipType) => {
        set((state) => {
          const newTimeline = { ...state.timeline };
          
          // Update in video tracks
          newTimeline.videoTracks = newTimeline.videoTracks.map(track =>
            track.map(clip =>
              clip.clipId === clipId ? { ...clip, ...updates } : clip
            )
          );
          
          // Update in audio tracks
          newTimeline.audioTracks = newTimeline.audioTracks.map(track =>
            track.map(clip =>
              clip.clipId === clipId ? { ...clip, ...updates } : clip
            )
          );
          
          return { timeline: newTimeline };
        });
      },
      
      removeClip: (clipId: string) => {
        set((state) => {
          const newTimeline = { ...state.timeline };
          
          // Remove from video tracks
          newTimeline.videoTracks = newTimeline.videoTracks.map(track =>
            track.filter(clip => clip.clipId !== clipId)
          );
          
          // Remove from audio tracks
          newTimeline.audioTracks = newTimeline.audioTracks.map(track =>
            track.filter(clip => clip.clipId !== clipId)
          );
          
          // Clear selection if the removed clip was selected
          const selectedClipId = state.selectedClipId === clipId ? null : state.selectedClipId;
          
          return { 
            timeline: newTimeline,
            selectedClipId
          };
        });
      },
      
      splitClip: (clipId: string, splitTime: number) => {
        set((state) => {
          // Find the clip to split
          let clipToSplit: ClipType | null = null;
          let trackType: 'video' | 'audio' | null = null;
          let trackIndex = -1;
          
          // Search in video tracks
          for (let i = 0; i < state.timeline.videoTracks.length; i++) {
            const clip = state.timeline.videoTracks[i].find(c => c.clipId === clipId);
            if (clip) {
              clipToSplit = clip;
              trackType = 'video';
              trackIndex = i;
              break;
            }
          }
          
          // Search in audio tracks if not found in video tracks
          if (!clipToSplit) {
            for (let i = 0; i < state.timeline.audioTracks.length; i++) {
              const clip = state.timeline.audioTracks[i].find(c => c.clipId === clipId);
              if (clip) {
                clipToSplit = clip;
                trackType = 'audio';
                trackIndex = i;
                break;
              }
            }
          }
          
          // If clip not found or split time is outside clip bounds, return unchanged state
          if (!clipToSplit || !trackType || trackIndex === -1) {
            return state;
          }
          
          const clipEndTime = clipToSplit.startTime + clipToSplit.duration;
          if (splitTime <= clipToSplit.startTime || splitTime >= clipEndTime) {
            return state;
          }
          
          // Create two new clips from the original
          const firstClip: ClipType = {
            ...clipToSplit,
            clipId: generateId(),
            duration: splitTime - clipToSplit.startTime
          };
          
          const secondClip: ClipType = {
            ...clipToSplit,
            clipId: generateId(),
            startTime: splitTime,
            duration: clipEndTime - splitTime
          };
          
          const newTimeline = { ...state.timeline };
          
          if (trackType === 'video') {
            newTimeline.videoTracks = newTimeline.videoTracks.map((track, index) => {
              if (index === trackIndex) {
                return track.map(clip => 
                  clip.clipId === clipId 
                    ? [firstClip, secondClip] 
                    : [clip]
                ).flat();
              }
              return track;
            });
          } else {
            newTimeline.audioTracks = newTimeline.audioTracks.map((track, index) => {
              if (index === trackIndex) {
                return track.map(clip => 
                  clip.clipId === clipId 
                    ? [firstClip, secondClip] 
                    : [clip]
                ).flat();
              }
              return track;
            });
          }
          
          // Update selection to the first clip
          return {
            timeline: newTimeline,
            selectedClipId: firstClip.clipId,
            selectedClipIds: [firstClip.clipId]
          };
        });
      },
      
      // Selection and playback actions (these should not be tracked in undo/redo)
      setSelectedClipId: (id: string | null) => {
        set({ 
          selectedClipId: id,
          selectedClipIds: id ? [id] : []
        });
      },
      
      setSelectedClipIds: (ids: string[]) => {
        set({ 
          selectedClipIds: ids,
          selectedClipId: ids.length === 1 ? ids[0] : null
        });
      },
      
      addToSelection: (clipId: string) => {
        set((state) => {
          const newSelectedIds = [...state.selectedClipIds];
          if (!newSelectedIds.includes(clipId)) {
            newSelectedIds.push(clipId);
          }
          return {
            selectedClipIds: newSelectedIds,
            selectedClipId: newSelectedIds.length === 1 ? newSelectedIds[0] : null
          };
        });
      },
      
      removeFromSelection: (clipId: string) => {
        set((state) => {
          const newSelectedIds = state.selectedClipIds.filter(id => id !== clipId);
          return {
            selectedClipIds: newSelectedIds,
            selectedClipId: newSelectedIds.length === 1 ? newSelectedIds[0] : null
          };
        });
      },
      
      toggleSelection: (clipId: string) => {
        set((state) => {
          const isSelected = state.selectedClipIds.includes(clipId);
          const newSelectedIds = isSelected
            ? state.selectedClipIds.filter(id => id !== clipId)
            : [...state.selectedClipIds, clipId];
          
          return {
            selectedClipIds: newSelectedIds,
            selectedClipId: newSelectedIds.length === 1 ? newSelectedIds[0] : null
          };
        });
      },
      
      clearSelection: () => {
        set({ 
          selectedClipIds: [],
          selectedClipId: null
        });
      },
      
      setCurrentTime: (time: number) => {
        set({ currentTime: Math.max(0, time) });
      },
      
      setPlaying: (playing: boolean) => {
        set({ isPlaying: playing });
      },
      
      setTimelineScale: (scale: number) => {
        set({ timelineScale: Math.max(10, Math.min(200, scale)) }); // Clamp between 10-200
      },
      
      // Batch operations for multi-select
      deleteSelectedClips: () => {
        set((state) => {
          if (state.selectedClipIds.length === 0) return state;
          
          const newTimeline = { ...state.timeline };
          
          // Remove selected clips from video tracks
          newTimeline.videoTracks = newTimeline.videoTracks.map(track =>
            track.filter(clip => !state.selectedClipIds.includes(clip.clipId))
          );
          
          // Remove selected clips from audio tracks
          newTimeline.audioTracks = newTimeline.audioTracks.map(track =>
            track.filter(clip => !state.selectedClipIds.includes(clip.clipId))
          );
          
          return {
            timeline: newTimeline,
            selectedClipIds: [],
            selectedClipId: null
          };
        });
      },
      
      moveSelectedClips: (deltaTime: number) => {
        set((state) => {
          if (state.selectedClipIds.length === 0) return state;
          
          const newTimeline = { ...state.timeline };
          
          // Move selected clips in video tracks
          newTimeline.videoTracks = newTimeline.videoTracks.map(track =>
            track.map(clip => 
              state.selectedClipIds.includes(clip.clipId)
                ? { ...clip, startTime: Math.max(0, clip.startTime + deltaTime) }
                : clip
            )
          );
          
          // Move selected clips in audio tracks
          newTimeline.audioTracks = newTimeline.audioTracks.map(track =>
            track.map(clip => 
              state.selectedClipIds.includes(clip.clipId)
                ? { ...clip, startTime: Math.max(0, clip.startTime + deltaTime) }
                : clip
            )
          );
          
          return { timeline: newTimeline };
        });
      },
      
      updateSelectedClipsProperties: (updates: PartialClipType) => {
        set((state) => {
          if (state.selectedClipIds.length === 0) return state;
          
          const newTimeline = { ...state.timeline };
          
          // Update selected clips in video tracks
          newTimeline.videoTracks = newTimeline.videoTracks.map(track =>
            track.map(clip => 
              state.selectedClipIds.includes(clip.clipId)
                ? { ...clip, ...updates }
                : clip
            )
          );
          
          // Update selected clips in audio tracks
          newTimeline.audioTracks = newTimeline.audioTracks.map(track =>
            track.map(clip => 
              state.selectedClipIds.includes(clip.clipId)
                ? { ...clip, ...updates }
                : clip
            )
          );
          
          return { timeline: newTimeline };
        });
      },
      
      // Project management actions
      loadProject: (project: AetherProjectType) => {
        set(project);
      },
      
      resetProject: () => {
        set(createDefaultProject());
      }
    }), {
      // Configure temporal middleware options
      limit: 50, // Keep last 50 undo states
      partialize: (state) => {
        // Only track specific parts of the state for undo/redo
        // Explicitly return only the trackable state
        const trackableState = {
          projectSettings: state.projectSettings,
          assetLibrary: state.assetLibrary,
          timeline: state.timeline
        };
        
        return trackableState;
      },
      equality: (pastState, currentState) => {
        // Use deep equality for the partitioned state
        return JSON.stringify(pastState) === JSON.stringify(currentState);
      }
    })
  )
);

// Selector hooks for specific parts of the state
export const useAssetLibrary = () => useAetherStore((state) => state.assetLibrary);
export const useTimeline = () => useAetherStore((state) => state.timeline);
export const useSelectedClipId = () => useAetherStore((state) => state.selectedClipId);
export const useSelectedClipIds = () => useAetherStore((state) => state.selectedClipIds);
export const useCurrentTime = () => useAetherStore((state) => state.currentTime);
export const useIsPlaying = () => useAetherStore((state) => state.isPlaying);
export const useTimelineScale = () => useAetherStore((state) => state.timelineScale);
export const useProjectSettings = () => useAetherStore((state) => state.projectSettings);

// Action hooks for cleaner component usage
export const useAetherActions = () => useAetherStore((state) => ({
  addAsset: state.addAsset,
  updateAsset: state.updateAsset,
  removeAsset: state.removeAsset,
  addClipToTimeline: state.addClipToTimeline,
  updateClipProperties: state.updateClipProperties,
  removeClip: state.removeClip,
  splitClip: state.splitClip,
  setSelectedClipId: state.setSelectedClipId,
  setSelectedClipIds: state.setSelectedClipIds,
  addToSelection: state.addToSelection,
  removeFromSelection: state.removeFromSelection,
  toggleSelection: state.toggleSelection,
  clearSelection: state.clearSelection,
  deleteSelectedClips: state.deleteSelectedClips,
  moveSelectedClips: state.moveSelectedClips,
  updateSelectedClipsProperties: state.updateSelectedClipsProperties,
  setCurrentTime: state.setCurrentTime,
  setPlaying: state.setPlaying,
  setTimelineScale: state.setTimelineScale,
  loadProject: state.loadProject,
  resetProject: state.resetProject
}));

// Undo/Redo hooks using zundo
export const useUndoRedo = () => {
  // Use the temporal state directly from the store
  const temporalState = useAetherStore.temporal.getState();
  
  // Subscribe to temporal state changes to trigger re-renders
  const [, forceUpdate] = React.useReducer(x => x + 1, 0);
  
  React.useEffect(() => {
    const unsubscribe = useAetherStore.temporal.subscribe(() => {
      forceUpdate();
    });
    return unsubscribe;
  }, []);
  
  return {
    undo: () => {
      try {
        useAetherStore.temporal.getState().undo();
        console.debug('Undo operation completed');
      } catch (error) {
        console.error('Undo failed:', error);
      }
    },
    redo: () => {
      try {
        useAetherStore.temporal.getState().redo();
        console.debug('Redo operation completed');
      } catch (error) {
        console.error('Redo failed:', error);
      }
    },
    clear: () => {
      try {
        useAetherStore.temporal.getState().clear();
        console.debug('Undo/Redo history cleared');
      } catch (error) {
        console.error('Clear history failed:', error);
      }
    },
    canUndo: temporalState.pastStates.length > 0,
    canRedo: temporalState.futureStates.length > 0,
    historySize: temporalState.pastStates.length
  };
};

// Auto-save subscription - set up after store creation
let isInitialized = false;

// Function to reset initialization state (for testing)
export const resetInitializationState = () => {
  isInitialized = false;
};

// Function to extract project data from store state (excluding actions and temporal state)
const extractProjectData = (state: any): AetherProjectType => {
  const {
    // Extract only the project data fields
    projectSettings,
    assetLibrary,
    timeline,
    selectedClipId,
    selectedClipIds,
    currentTime,
    isPlaying,
    timelineScale
  } = state;

  return {
    projectSettings,
    assetLibrary,
    timeline,
    selectedClipId,
    selectedClipIds,
    currentTime,
    isPlaying,
    timelineScale
  };
};

// Initialize auto-save and project restoration
export const initializePersistence = async () => {
  if (isInitialized || !isIndexedDBSupported()) {
    return;
  }

  try {
    // Try to restore the last saved project
    const savedProject = await loadProjectFromDB();
    if (savedProject) {
      useAetherStore.getState().loadProject(savedProject);
      console.log('Project restored from local storage');
    }

    // Set up auto-save subscription
    useAetherStore.subscribe(
      (state) => extractProjectData(state),
      (projectData) => {
        // Only auto-save if we've finished initialization
        if (isInitialized) {
          debouncedSave(projectData);
        }
      },
      {
        // Use deep equality to avoid unnecessary saves
        equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b)
      }
    );

    isInitialized = true;
    console.log('Auto-save initialized');
  } catch (error) {
    console.error('Failed to initialize persistence:', error);
  }
};

// Manual save function for explicit saves
export const saveProject = async (): Promise<void> => {
  if (!isIndexedDBSupported()) {
    throw new Error('Local storage not supported');
  }

  try {
    const state = useAetherStore.getState();
    const projectData = extractProjectData(state);
    await saveProjectToDB(projectData);
    console.log('Project saved manually');
  } catch (error) {
    console.error('Manual save failed:', error);
    throw error;
  }
};

// Function to restore a project (can be used for loading different projects in the future)
export const restoreProject = async (projectId?: string): Promise<boolean> => {
  if (!isIndexedDBSupported()) {
    return false;
  }

  try {
    const savedProject = await loadProjectFromDB(projectId);
    if (savedProject) {
      useAetherStore.getState().loadProject(savedProject);
      console.log('Project restored successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to restore project:', error);
    return false;
  }
};