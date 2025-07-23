import React from 'react';
import { ZoomIn, ZoomOut, SkipBack, SkipForward, Home, MoveRight } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { useTimelineScale, useCurrentTime, useAetherActions, useProjectSettings } from '../store/useAetherStore';

export const TimelineControls: React.FC = () => {
  const timelineScale = useTimelineScale();
  const currentTime = useCurrentTime();
  const projectSettings = useProjectSettings();
  const { setTimelineScale, setCurrentTime } = useAetherActions();

  // Zoom levels: 10-200 pixels per second
  const minZoom = 10;
  const maxZoom = 200;
  const zoomStep = 10;

  // Navigation step size (in seconds)
  const navigationStep = 1;

  // Handle zoom in
  const handleZoomIn = () => {
    const newScale = Math.min(maxZoom, timelineScale + zoomStep);
    setTimelineScale(newScale);
  };

  // Handle zoom out
  const handleZoomOut = () => {
    const newScale = Math.max(minZoom, timelineScale - zoomStep);
    setTimelineScale(newScale);
  };

  // Handle zoom slider change
  const handleZoomSliderChange = (value: number[]) => {
    setTimelineScale(value[0]);
  };

  // Handle navigation
  const handleGoToStart = () => {
    setCurrentTime(0);
  };

  const handleGoToEnd = () => {
    setCurrentTime(projectSettings.duration);
  };

  const handleStepBackward = () => {
    setCurrentTime(Math.max(0, currentTime - navigationStep));
  };

  const handleStepForward = () => {
    setCurrentTime(Math.min(projectSettings.duration, currentTime + navigationStep));
  };

  // Format zoom percentage for display
  const getZoomPercentage = (scale: number): number => {
    // Calculate percentage based on a reasonable baseline (50 pixels per second = 100%)
    const baselineScale = 50;
    return Math.round((scale / baselineScale) * 100);
  };

  return (
    <div className="flex items-center gap-4 bg-card border border-border rounded-lg p-3">
      {/* Navigation Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToStart}
          title="Go to Start (Home)"
          className="h-8 w-8 p-0"
        >
          <Home className="h-3 w-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleStepBackward}
          title="Step Backward (Left Arrow)"
          className="h-8 w-8 p-0"
        >
          <SkipBack className="h-3 w-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleStepForward}
          title="Step Forward (Right Arrow)"
          className="h-8 w-8 p-0"
        >
          <SkipForward className="h-3 w-3" />
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoToEnd}
          title="Go to End (End)"
          className="h-8 w-8 p-0"
        >
          <MoveRight className="h-3 w-3" />
        </Button>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border" />

      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomOut}
          disabled={timelineScale <= minZoom}
          title="Zoom Out (-)"
          className="h-8 w-8 p-0"
        >
          <ZoomOut className="h-3 w-3" />
        </Button>

        {/* Zoom Slider */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Slider
            value={[timelineScale]}
            onValueChange={handleZoomSliderChange}
            min={minZoom}
            max={maxZoom}
            step={zoomStep}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground font-mono min-w-[40px] text-right">
            {getZoomPercentage(timelineScale)}%
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleZoomIn}
          disabled={timelineScale >= maxZoom}
          title="Zoom In (+)"
          className="h-8 w-8 p-0"
        >
          <ZoomIn className="h-3 w-3" />
        </Button>
      </div>

      {/* Current Time Display */}
      <div className="text-xs text-muted-foreground font-mono">
        {Math.floor(currentTime / 60).toString().padStart(2, '0')}:
        {Math.floor(currentTime % 60).toString().padStart(2, '0')}
      </div>
    </div>
  );
};