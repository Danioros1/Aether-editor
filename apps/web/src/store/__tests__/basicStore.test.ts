import { describe, it, expect, beforeEach } from 'vitest';
import { useAetherStore } from '../useAetherStore';
import { AssetType } from '@aether-editor/types';

describe('Basic Store Functionality', () => {
  let store: ReturnType<typeof useAetherStore.getState>;

  beforeEach(() => {
    // Reset store to initial state before each test
    useAetherStore.getState().resetProject();
    store = useAetherStore.getState();
  });

  const createMockAsset = (id: string): AssetType => ({
    assetId: id,
    fileName: `test-${id}.jpg`,
    type: 'image',
    sourceUrl: `http://localhost:3001/uploads/test-${id}.jpg`,
    thumbnailUrl: `http://localhost:3001/uploads/test-${id}-thumb.jpg`,
    duration: 5,
    isPlaceholder: false
  });

  it('should add assets to the library', () => {
    const asset = createMockAsset('1');
    
    console.log('Initial state:', store.assetLibrary.length);
    store.addAsset(asset);
    
    // Get fresh store state after the action
    const updatedStore = useAetherStore.getState();
    console.log('After adding asset:', updatedStore.assetLibrary.length);
    console.log('Asset library:', updatedStore.assetLibrary);
    
    expect(updatedStore.assetLibrary).toHaveLength(1);
    expect(updatedStore.assetLibrary[0]).toEqual(asset);
  });

  it('should update asset properties', () => {
    const asset = createMockAsset('1');
    store.addAsset(asset);
    
    const updates = { fileName: 'updated-file.jpg' };
    store.updateAsset(asset.assetId, updates);
    
    // Get fresh store state after the action
    const updatedStore = useAetherStore.getState();
    expect(updatedStore.assetLibrary[0].fileName).toBe('updated-file.jpg');
  });

  it('should add clips to timeline', () => {
    const asset = createMockAsset('1');
    store.addAsset(asset);
    
    store.addClipToTimeline(asset, 10);
    
    expect(store.timeline.videoTracks[0]).toHaveLength(1);
    expect(store.timeline.videoTracks[0][0].startTime).toBe(10);
  });
});