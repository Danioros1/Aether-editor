import { AetherProjectType } from '@aether-editor/types';
import { createMockAssetLibrary } from './assetFactory';
import { createMockClipSequence } from './clipFactory';

export interface ProjectFactoryOptions {
  name?: string;
  resolution?: AetherProjectType['projectSettings']['resolution'];
  fps?: number;
  duration?: number;
  assetCount?: number;
  clipCount?: number;
  selectedClipId?: string | null;
  selectedClipIds?: string[];
  currentTime?: number;
  isPlaying?: boolean;
  timelineScale?: number;
}

export const createMockProject = (options: ProjectFactoryOptions = {}): AetherProjectType => {
  const assets = createMockAssetLibrary(options.assetCount || 3);
  const clips = createMockClipSequence(options.clipCount || 2);
  
  return {
    projectSettings: {
      name: options.name || 'Test Project',
      resolution: options.resolution || '1080p',
      fps: options.fps || 30,
      duration: options.duration || clips.reduce((total, clip) => Math.max(total, clip.startTime + clip.duration), 0)
    },
    assetLibrary: assets,
    timeline: {
      videoTracks: [clips],
      audioTracks: [[]]
    },
    selectedClipId: options.selectedClipId || null,
    selectedClipIds: options.selectedClipIds || [],
    currentTime: options.currentTime || 0,
    isPlaying: options.isPlaying || false,
    timelineScale: options.timelineScale || 50
  };
};

export const createEmptyProject = (options: Partial<ProjectFactoryOptions> = {}): AetherProjectType => {
  return createMockProject({
    ...options,
    assetCount: 0,
    clipCount: 0,
    duration: 0
  });
};

export const createLargeProject = (options: Partial<ProjectFactoryOptions> = {}): AetherProjectType => {
  return createMockProject({
    ...options,
    assetCount: 50,
    clipCount: 100,
    duration: 600 // 10 minutes
  });
};

export const createProjectWithSelectedClip = (clipId?: string): AetherProjectType => {
  const project = createMockProject();
  const selectedId = clipId || project.timeline.videoTracks[0][0]?.clipId || null;
  
  return {
    ...project,
    selectedClipId: selectedId,
    selectedClipIds: selectedId ? [selectedId] : []
  };
};

export const createProjectWithMultipleSelection = (clipIds?: string[]): AetherProjectType => {
  const project = createMockProject({ clipCount: 5 });
  const selectedIds = clipIds || project.timeline.videoTracks[0].slice(0, 3).map(clip => clip.clipId);
  
  return {
    ...project,
    selectedClipId: selectedIds[0] || null,
    selectedClipIds: selectedIds
  };
};