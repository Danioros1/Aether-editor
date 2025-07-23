import { describe, it, expect, beforeEach } from 'vitest';
import { useAetherStore, useUndoRedo } from '../useAetherStore';
import { AssetType } from '@aether-editor/types';
import { renderHook, act } from '@testing-library/react';

describe('Debug Temporal State', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAetherStore.getState().resetProject();
    // Clear temporal history
    useAetherStore.temporal.getState().clear();
  });

  const createMockAsset = (id: string): AssetType => ({
    assetId: id,
    fileName: `test-${id}.jpg`,
    type: 'image',
    isPlaceholder: false,
    sourceUrl: `http://localhost:3001/uploads/test-${id}.jpg`,
    thumbnailUrl: `http://localhost:3001/uploads/test-${id}-thumb.jpg`,
    duration: 5
  });

  it('should debug temporal state changes', () => {
    const asset = createMockAsset('1');
    const { result: undoRedoResult } = renderHook(() => useUndoRedo());
    
    // Test partialize function manually
    const testPartialize = (state: any) => {
      const { 
        selectedClipId, 
        selectedClipIds, 
        currentTime, 
        isPlaying, 
        timelineScale,
        ...trackableState 
      } = state;
      
      return {
        projectSettings: trackableState.projectSettings,
        assetLibrary: trackableState.assetLibrary,
        timeline: trackableState.timeline
      };
    };
    
    console.log('Initial partialize result:', testPartialize(useAetherStore.getState()));
    
    // Add asset
    act(() => {
      useAetherStore.getState().addAsset(asset);
    });
    
    console.log('After adding asset partialize result:', testPartialize(useAetherStore.getState()));
    console.log('Temporal past states length:', useAetherStore.temporal.getState().pastStates.length);
    
    // Add clip to timeline
    act(() => {
      useAetherStore.getState().addClipToTimeline(asset, 10);
    });
    
    console.log('After adding clip partialize result:', testPartialize(useAetherStore.getState()));
    console.log('Temporal past states length:', useAetherStore.temporal.getState().pastStates.length);
    console.log('Past states:', useAetherStore.temporal.getState().pastStates);
    
    // Try undo
    console.log('Before undo - current state timeline:', useAetherStore.getState().timeline);
    console.log('Before undo - temporal state:', {
      pastStates: useAetherStore.temporal.getState().pastStates.length,
      futureStates: useAetherStore.temporal.getState().futureStates.length
    });
    
    act(() => {
      undoRedoResult.current.undo();
    });
    
    console.log('After undo partialize result:', testPartialize(useAetherStore.getState()));
    console.log('Store timeline after undo:', useAetherStore.getState().timeline);
    console.log('After undo - temporal state:', {
      pastStates: useAetherStore.temporal.getState().pastStates.length,
      futureStates: useAetherStore.temporal.getState().futureStates.length
    });
    
    expect(true).toBe(true); // Just to make the test pass
  });
});