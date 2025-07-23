import React from 'react';
import { Play, Pause, Square } from 'lucide-react';
import { usePlaybackEngine } from '../hooks/usePlaybackEngine';

// Format time in MM:SS format
const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const TransportControls: React.FC = () => {
  const { isPlaying, currentTime, togglePlayPause, stop } = usePlaybackEngine();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={togglePlayPause}
        className="flex items-center justify-center w-10 h-10 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4 ml-0.5" />
        )}
      </button>
      
      <button
        onClick={stop}
        className="flex items-center justify-center w-10 h-10 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
        title="Stop"
      >
        <Square className="w-4 h-4" />
      </button>
      
      <div className="ml-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">
          {formatTime(currentTime)}
        </span>
        {isPlaying && (
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Recording" />
        )}
      </div>
    </div>
  );
};