import { ClipType } from '@aether-editor/types';

export interface ClipFactoryOptions {
  clipId?: string;
  assetId?: string;
  startTime?: number;
  duration?: number;
  volume?: number;
  textOverlays?: ClipType['textOverlays'];
}

let clipCounter = 0;

export const createMockClip = (options: ClipFactoryOptions = {}): ClipType => {
  const id = options.clipId || `test-clip-${++clipCounter}`;
  
  return {
    clipId: id,
    assetId: options.assetId || `test-asset-${clipCounter}`,
    startTime: options.startTime || 0,
    duration: options.duration || 10,
    volume: options.volume || 1,
    textOverlays: options.textOverlays || []
  };
};

export const createMockClipSequence = (count: number = 3, clipDuration: number = 10): ClipType[] => {
  const clips: ClipType[] = [];
  
  for (let i = 0; i < count; i++) {
    clips.push(createMockClip({
      startTime: i * clipDuration,
      duration: clipDuration,
      assetId: `test-asset-${i + 1}`
    }));
  }
  
  return clips;
};

export const createMockOverlappingClips = (count: number = 2): ClipType[] => {
  const clips: ClipType[] = [];
  
  for (let i = 0; i < count; i++) {
    clips.push(createMockClip({
      startTime: i * 5, // Overlap by 5 seconds
      duration: 10,
      assetId: `test-asset-${i + 1}`
    }));
  }
  
  return clips;
};

export const createMockClipWithTextOverlay = (options: ClipFactoryOptions = {}): ClipType => {
  return createMockClip({
    ...options,
    textOverlays: options.textOverlays || [{
      text: 'Sample Text',
      startTime: 0,
      duration: 5,
      position: { x: 50, y: 50 },
      style: {
        fontSize: 24,
        color: '#ffffff',
        fontFamily: 'Arial'
      }
    }]
  });
};

export const resetClipCounter = () => {
  clipCounter = 0;
};