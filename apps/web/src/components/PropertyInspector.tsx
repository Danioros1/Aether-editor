import React, { useState, useCallback } from 'react';
import { useAetherStore } from '../store/useAetherStore';
import { ClipType, AssetType } from '@aether-editor/types';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export const PropertyInspector: React.FC = () => {
  const selectedClipId = useAetherStore((state) => state.selectedClipId);
  const timeline = useAetherStore((state) => state.timeline);
  const assetLibrary = useAetherStore((state) => state.assetLibrary);
  const updateClipProperties = useAetherStore((state) => state.updateClipProperties);
  
  // State for validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Find the selected clip from all tracks
  const selectedClip = React.useMemo((): ClipType | null => {
    if (!selectedClipId) return null;
    
    // Search in video tracks
    for (const track of timeline.videoTracks) {
      const clip = track.find(c => c.clipId === selectedClipId);
      if (clip) return clip;
    }
    
    // Search in audio tracks
    for (const track of timeline.audioTracks) {
      const clip = track.find(c => c.clipId === selectedClipId);
      if (clip) return clip;
    }
    
    return null;
  }, [selectedClipId, timeline]);

  // Find the associated asset for the selected clip
  const selectedAsset = React.useMemo((): AssetType | null => {
    if (!selectedClip) return null;
    return assetLibrary.find(asset => asset.assetId === selectedClip.assetId) || null;
  }, [selectedClip, assetLibrary]);

  // Basic validation function (simplified without schema for now)
  const validateClipProperty = useCallback((key: string, value: any): string | null => {
    if (!selectedClip) return null;
    
    // Basic validation rules
    switch (key) {
      case 'startTime':
        if (typeof value !== 'number' || value < 0) {
          return 'Start time must be a positive number';
        }
        break;
      case 'duration':
        if (typeof value !== 'number' || value <= 0) {
          return 'Duration must be a positive number';
        }
        break;
      case 'volume':
        if (typeof value !== 'number' || value < 0 || value > 2) {
          return 'Volume must be between 0 and 2';
        }
        break;
    }
    
    return null; // No error
  }, [selectedClip]);

  // Generic property update handler
  const handlePropertyChange = useCallback((key: string, value: any) => {
    if (!selectedClip) return;
    
    // Validate the new value
    const error = validateClipProperty(key, value);
    
    // Update errors state
    setErrors(prev => ({
      ...prev,
      [key]: error || ''
    }));
    
    // Only update if valid
    if (!error) {
      updateClipProperties(selectedClip.clipId, { [key]: value });
    }
  }, [selectedClip, validateClipProperty, updateClipProperties]);

  // Nested property update handler for animations and transitions
  const handleNestedPropertyChange = useCallback((parentKey: string, childKey: string, value: any, grandChildKey?: string) => {
    if (!selectedClip) return;
    
    let updatedProperty: any;
    const currentParentValue = selectedClip[parentKey as keyof ClipType] as any;
    
    if (grandChildKey) {
      // For deeply nested properties like animation.startRect.x
      const currentChildValue = currentParentValue?.[childKey] || {};
      updatedProperty = {
        ...(currentParentValue || {}),
        [childKey]: {
          ...currentChildValue,
          [grandChildKey]: value
        }
      };
    } else {
      // For nested properties like transition.duration
      updatedProperty = {
        ...(currentParentValue || {}),
        [childKey]: value
      };
    }
    
    // Validate the entire nested object
    const error = validateClipProperty(parentKey, updatedProperty);
    const errorKey = grandChildKey ? `${parentKey}.${childKey}.${grandChildKey}` : `${parentKey}.${childKey}`;
    
    // Update errors state
    setErrors(prev => ({
      ...prev,
      [errorKey]: error || ''
    }));
    
    // Only update if valid
    if (!error) {
      updateClipProperties(selectedClip.clipId, { [parentKey]: updatedProperty });
    }
  }, [selectedClip, validateClipProperty, updateClipProperties]);

  // Text overlay update handler
  const handleTextOverlayChange = useCallback((index: number, key: string, value: any, isPosition = false) => {
    if (!selectedClip || !selectedClip.textOverlays) return;
    
    const updatedOverlays = [...selectedClip.textOverlays];
    if (isPosition) {
      updatedOverlays[index] = {
        ...updatedOverlays[index],
        position: {
          ...updatedOverlays[index].position,
          [key]: value
        }
      };
    } else {
      updatedOverlays[index] = {
        ...updatedOverlays[index],
        [key]: value
      };
    }
    
    // Validate the entire textOverlays array
    const error = validateClipProperty('textOverlays', updatedOverlays);
    const errorKey = isPosition ? `textOverlays.${index}.position.${key}` : `textOverlays.${index}.${key}`;
    
    // Update errors state
    setErrors(prev => ({
      ...prev,
      [errorKey]: error || ''
    }));
    
    // Only update if valid
    if (!error) {
      updateClipProperties(selectedClip.clipId, { textOverlays: updatedOverlays });
    }
  }, [selectedClip, validateClipProperty, updateClipProperties]);

  // Add Ken Burns animation
  const addKenBurnsAnimation = useCallback(() => {
    if (!selectedClip) return;
    
    const defaultAnimation = {
      type: 'ken_burns' as const,
      startRect: { x: 0, y: 0, scale: 1 },
      endRect: { x: 0, y: 0, scale: 1.2 }
    };
    
    updateClipProperties(selectedClip.clipId, { animation: defaultAnimation });
  }, [selectedClip, updateClipProperties]);

  // Remove Ken Burns animation
  const removeKenBurnsAnimation = useCallback(() => {
    if (!selectedClip) return;
    updateClipProperties(selectedClip.clipId, { animation: undefined });
  }, [selectedClip, updateClipProperties]);

  // Add transition
  const addTransition = useCallback(() => {
    if (!selectedClip) return;
    
    const defaultTransition = {
      type: 'cross_dissolve' as const,
      duration: 1
    };
    
    updateClipProperties(selectedClip.clipId, { transition: defaultTransition });
  }, [selectedClip, updateClipProperties]);

  // Remove transition
  const removeTransition = useCallback(() => {
    if (!selectedClip) return;
    updateClipProperties(selectedClip.clipId, { transition: undefined });
  }, [selectedClip, updateClipProperties]);

  // Add text overlay
  const addTextOverlay = useCallback(() => {
    if (!selectedClip) return;
    
    const newOverlay = {
      text: 'New Text',
      startTime: 0,
      duration: 2,
      position: { x: 0, y: 0 }
    };
    
    const updatedOverlays = [...(selectedClip.textOverlays || []), newOverlay];
    updateClipProperties(selectedClip.clipId, { textOverlays: updatedOverlays });
  }, [selectedClip, updateClipProperties]);

  // Remove text overlay
  const removeTextOverlay = useCallback((index: number) => {
    if (!selectedClip || !selectedClip.textOverlays) return;
    
    const updatedOverlays = selectedClip.textOverlays.filter((_, i) => i !== index);
    updateClipProperties(selectedClip.clipId, { textOverlays: updatedOverlays });
  }, [selectedClip, updateClipProperties]);

  if (!selectedClip) {
    return (
      <div className="space-y-4" role="region" aria-label="Property inspector">
        <div className="text-muted-foreground text-sm" role="status" aria-live="polite">
          Select a clip to edit properties
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="region" aria-label="Clip properties editor" aria-describedby="property-inspector-instructions">
      {/* Screen reader instructions */}
      <div id="property-inspector-instructions" className="sr-only">
        Property inspector for editing the selected clip. 
        Modify timing, effects, and text overlays. 
        Changes are applied automatically as you type.
      </div>
      
      {/* Read-only fields */}
      <fieldset className="space-y-2">
        <legend className="sr-only">Clip information</legend>
        <div className="space-y-2">
          <Label htmlFor="clip-id">Clip ID</Label>
          <Input
            id="clip-id"
            value={selectedClip.clipId}
            readOnly
            className="bg-muted"
            aria-describedby="clip-id-desc"
          />
          <div id="clip-id-desc" className="sr-only">
            Unique identifier for this clip, read-only
          </div>
        </div>

        {selectedAsset && (
          <div className="space-y-2">
            <Label htmlFor="asset-name">Asset Name</Label>
            <Input
              id="asset-name"
              value={selectedAsset.fileName}
              readOnly
              className="bg-muted"
              aria-describedby="asset-name-desc"
            />
            <div id="asset-name-desc" className="sr-only">
              Name of the source asset file, read-only
            </div>
          </div>
        )}
      </fieldset>

      {/* Editable properties */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Timing Properties</legend>
        
        <div className="space-y-2">
          <Label htmlFor="start-time">Start Time (s)</Label>
          <Input
            id="start-time"
            type="number"
            value={selectedClip.startTime}
            onChange={(e) => handlePropertyChange('startTime', parseFloat(e.target.value) || 0)}
            step="0.1"
            min="0"
            className={errors.startTime ? 'border-red-500' : ''}
            aria-describedby={errors.startTime ? 'start-time-error' : 'start-time-desc'}
            aria-invalid={!!errors.startTime}
          />
          <div id="start-time-desc" className="sr-only">
            When this clip starts on the timeline, in seconds
          </div>
          {errors.startTime && (
            <div id="start-time-error" className="text-red-500 text-xs" role="alert">
              {errors.startTime}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duration (s)</Label>
          <Input
            id="duration"
            type="number"
          value={selectedClip.duration}
          onChange={(e) => handlePropertyChange('duration', parseFloat(e.target.value) || 0)}
          step="0.1"
          min="0.1"
          className={errors.duration ? 'border-red-500' : ''}
        />
        {errors.duration && (
          <div className="text-red-500 text-xs">{errors.duration}</div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="volume">Volume</Label>
        <Input
          id="volume"
          type="number"
          value={selectedClip.volume}
          onChange={(e) => handlePropertyChange('volume', parseFloat(e.target.value) || 0)}
          step="0.1"
          min="0"
          max="2"
          className={errors.volume ? 'border-red-500' : ''}
        />
        {errors.volume && (
          <div className="text-red-500 text-xs">{errors.volume}</div>
        )}
      </div>
      </fieldset>

      {/* Ken Burns Animation Section */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Ken Burns Animation</legend>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Add smooth zoom and pan effects</span>
          {selectedClip.animation ? (
            <Button variant="outline" size="sm" onClick={removeKenBurnsAnimation}>
              Remove
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={addKenBurnsAnimation}>
              Add
            </Button>
          )}
        </div>
        
        {selectedClip.animation && (
          <div className="space-y-4 p-3 border rounded-md">
            <div className="text-xs font-medium text-muted-foreground">Start Position</div>
            
            <div className="space-y-2">
              <Label htmlFor="start-x">Start X</Label>
              <Input
                id="start-x"
                type="number"
                value={selectedClip.animation.startRect.x}
                onChange={(e) => handleNestedPropertyChange('animation', 'startRect', parseFloat(e.target.value) || 0, 'x')}
                step="0.1"
                className={errors['animation.startRect.x'] ? 'border-red-500' : ''}
              />
              {errors['animation.startRect.x'] && (
                <div className="text-red-500 text-xs">{errors['animation.startRect.x']}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-y">Start Y</Label>
              <Input
                id="start-y"
                type="number"
                value={selectedClip.animation.startRect.y}
                onChange={(e) => handleNestedPropertyChange('animation', 'startRect', parseFloat(e.target.value) || 0, 'y')}
                step="0.1"
                className={errors['animation.startRect.y'] ? 'border-red-500' : ''}
              />
              {errors['animation.startRect.y'] && (
                <div className="text-red-500 text-xs">{errors['animation.startRect.y']}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="start-scale">Start Scale</Label>
              <Input
                id="start-scale"
                type="number"
                value={selectedClip.animation.startRect.scale}
                onChange={(e) => handleNestedPropertyChange('animation', 'startRect', parseFloat(e.target.value) || 1, 'scale')}
                step="0.1"
                min="0.1"
                className={errors['animation.startRect.scale'] ? 'border-red-500' : ''}
              />
              {errors['animation.startRect.scale'] && (
                <div className="text-red-500 text-xs">{errors['animation.startRect.scale']}</div>
              )}
            </div>

            <div className="text-xs font-medium text-muted-foreground">End Position</div>

            <div className="space-y-2">
              <Label htmlFor="end-x">End X</Label>
              <Input
                id="end-x"
                type="number"
                value={selectedClip.animation.endRect.x}
                onChange={(e) => handleNestedPropertyChange('animation', 'endRect', parseFloat(e.target.value) || 0, 'x')}
                step="0.1"
                className={errors['animation.endRect.x'] ? 'border-red-500' : ''}
              />
              {errors['animation.endRect.x'] && (
                <div className="text-red-500 text-xs">{errors['animation.endRect.x']}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-y">End Y</Label>
              <Input
                id="end-y"
                type="number"
                value={selectedClip.animation.endRect.y}
                onChange={(e) => handleNestedPropertyChange('animation', 'endRect', parseFloat(e.target.value) || 0, 'y')}
                step="0.1"
                className={errors['animation.endRect.y'] ? 'border-red-500' : ''}
              />
              {errors['animation.endRect.y'] && (
                <div className="text-red-500 text-xs">{errors['animation.endRect.y']}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-scale">End Scale</Label>
              <Input
                id="end-scale"
                type="number"
                value={selectedClip.animation.endRect.scale}
                onChange={(e) => handleNestedPropertyChange('animation', 'endRect', parseFloat(e.target.value) || 1, 'scale')}
                step="0.1"
                min="0.1"
                className={errors['animation.endRect.scale'] ? 'border-red-500' : ''}
              />
              {errors['animation.endRect.scale'] && (
                <div className="text-red-500 text-xs">{errors['animation.endRect.scale']}</div>
              )}
            </div>
          </div>
        )}
      </fieldset>

      {/* Transition Section */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Transition Effects</legend>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Add transition effects between clips</span>
          {selectedClip.transition ? (
            <Button variant="outline" size="sm" onClick={removeTransition}>
              Remove
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={addTransition}>
              Add
            </Button>
          )}
        </div>
        
        {selectedClip.transition && (
          <div className="space-y-4 p-3 border rounded-md">
            <div className="space-y-2">
              <Label htmlFor="transition-type">Type</Label>
              <Input
                id="transition-type"
                value={selectedClip.transition.type}
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transition-duration">Duration (s)</Label>
              <Input
                id="transition-duration"
                type="number"
                value={selectedClip.transition.duration}
                onChange={(e) => handleNestedPropertyChange('transition', 'duration', parseFloat(e.target.value) || 0)}
                step="0.1"
                min="0.1"
                className={errors['transition.duration'] ? 'border-red-500' : ''}
              />
              {errors['transition.duration'] && (
                <div className="text-red-500 text-xs">{errors['transition.duration']}</div>
              )}
            </div>
          </div>
        )}
      </fieldset>

      {/* Text Overlays Section */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Text Overlays</legend>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Add text overlays to your clip</span>
          <Button variant="outline" size="sm" onClick={addTextOverlay}>
            Add Text
          </Button>
        </div>
        
        {selectedClip.textOverlays && selectedClip.textOverlays.length > 0 && (
          <div className="space-y-4">
            {selectedClip.textOverlays.map((overlay, index) => (
              <div key={index} className="space-y-2 p-3 border rounded-md">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-medium text-muted-foreground">
                    Overlay {index + 1}
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => removeTextOverlay(index)}
                    className="h-6 px-2 text-xs"
                    aria-label={`Remove text overlay ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor={`overlay-text-${index}`}>Text</Label>
                  <Input
                    id={`overlay-text-${index}`}
                    value={overlay.text}
                    onChange={(e) => handleTextOverlayChange(index, 'text', e.target.value)}
                    className={errors[`textOverlays.${index}.text`] ? 'border-red-500' : ''}
                    aria-describedby={errors[`textOverlays.${index}.text`] ? `overlay-text-${index}-error` : undefined}
                    aria-invalid={!!errors[`textOverlays.${index}.text`]}
                  />
                  {errors[`textOverlays.${index}.text`] && (
                    <div id={`overlay-text-${index}-error`} className="text-red-500 text-xs" role="alert">
                      {errors[`textOverlays.${index}.text`]}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`overlay-start-${index}`}>Start Time (s)</Label>
                  <Input
                    id={`overlay-start-${index}`}
                    type="number"
                    value={overlay.startTime}
                    onChange={(e) => handleTextOverlayChange(index, 'startTime', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0"
                    className={errors[`textOverlays.${index}.startTime`] ? 'border-red-500' : ''}
                    aria-describedby={errors[`textOverlays.${index}.startTime`] ? `overlay-start-${index}-error` : undefined}
                    aria-invalid={!!errors[`textOverlays.${index}.startTime`]}
                  />
                  {errors[`textOverlays.${index}.startTime`] && (
                    <div id={`overlay-start-${index}-error`} className="text-red-500 text-xs" role="alert">
                      {errors[`textOverlays.${index}.startTime`]}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`overlay-duration-${index}`}>Duration (s)</Label>
                  <Input
                    id={`overlay-duration-${index}`}
                    type="number"
                    value={overlay.duration}
                    onChange={(e) => handleTextOverlayChange(index, 'duration', parseFloat(e.target.value) || 0)}
                    step="0.1"
                    min="0.1"
                    className={errors[`textOverlays.${index}.duration`] ? 'border-red-500' : ''}
                    aria-describedby={errors[`textOverlays.${index}.duration`] ? `overlay-duration-${index}-error` : undefined}
                    aria-invalid={!!errors[`textOverlays.${index}.duration`]}
                  />
                  {errors[`textOverlays.${index}.duration`] && (
                    <div id={`overlay-duration-${index}-error`} className="text-red-500 text-xs" role="alert">
                      {errors[`textOverlays.${index}.duration`]}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor={`overlay-x-${index}`}>X Position</Label>
                    <Input
                      id={`overlay-x-${index}`}
                      type="number"
                      value={overlay.position.x}
                      onChange={(e) => handleTextOverlayChange(index, 'x', parseFloat(e.target.value) || 0, true)}
                      step="0.1"
                      className={errors[`textOverlays.${index}.position.x`] ? 'border-red-500' : ''}
                      aria-describedby={errors[`textOverlays.${index}.position.x`] ? `overlay-x-${index}-error` : undefined}
                      aria-invalid={!!errors[`textOverlays.${index}.position.x`]}
                    />
                    {errors[`textOverlays.${index}.position.x`] && (
                      <div id={`overlay-x-${index}-error`} className="text-red-500 text-xs" role="alert">
                        {errors[`textOverlays.${index}.position.x`]}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`overlay-y-${index}`}>Y Position</Label>
                    <Input
                      id={`overlay-y-${index}`}
                      type="number"
                      value={overlay.position.y}
                      onChange={(e) => handleTextOverlayChange(index, 'y', parseFloat(e.target.value) || 0, true)}
                      step="0.1"
                      className={errors[`textOverlays.${index}.position.y`] ? 'border-red-500' : ''}
                      aria-describedby={errors[`textOverlays.${index}.position.y`] ? `overlay-y-${index}-error` : undefined}
                      aria-invalid={!!errors[`textOverlays.${index}.position.y`]}
                    />
                    {errors[`textOverlays.${index}.position.y`] && (
                      <div id={`overlay-y-${index}-error`} className="text-red-500 text-xs" role="alert">
                        {errors[`textOverlays.${index}.position.y`]}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  );
};