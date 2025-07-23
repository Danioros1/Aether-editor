import React, { useCallback, useEffect, useRef } from 'react';
import { useAetherActions, useIsPlaying, useCurrentTime, useProjectSettings } from '../store/useAetherStore';

export interface PlaybackEngine {
  togglePlayPause: () => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
}

export const usePlaybackEngine = (): PlaybackEngine => {
  const isPlaying = useIsPlaying();
  const currentTime = useCurrentTime();
  const projectSettings = useProjectSettings();
  const { setPlaying, setCurrentTime } = useAetherActions();
  
  // Internal state for playback rate
  const playbackRateRef = useRef(1);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const play = useCallback(() => {
    try {
      setPlaying(true);
    } catch (error) {
      console.error('PlaybackEngine: Failed to start playback:', error);
    }
  }, [setPlaying]);

  const pause = useCallback(() => {
    try {
      setPlaying(false);
    } catch (error) {
      console.error('PlaybackEngine: Failed to pause playback:', error);
    }
  }, [setPlaying]);

  const stop = useCallback(() => {
    try {
      setPlaying(false);
      setCurrentTime(0);
    } catch (error) {
      console.error('PlaybackEngine: Failed to stop playback:', error);
    }
  }, [setPlaying, setCurrentTime]);

  const seek = useCallback((time: number) => {
    try {
      const clampedTime = Math.max(0, Math.min(time, projectSettings.duration));
      setCurrentTime(clampedTime);
    } catch (error) {
      console.error('PlaybackEngine: Failed to seek:', error);
    }
  }, [setCurrentTime, projectSettings.duration]);



  const togglePlayPause = useCallback(() => {
    try {
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    } catch (error) {
      console.error('PlaybackEngine: Failed to toggle playback:', error);
    }
  }, [isPlaying, play, pause]);

  // Handle playback timing updates
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const updateTime = (timestamp: number) => {
      if (lastUpdateTimeRef.current === 0) {
        lastUpdateTimeRef.current = timestamp;
      }

      const deltaTime = (timestamp - lastUpdateTimeRef.current) / 1000; // Convert to seconds
      const adjustedDelta = deltaTime * playbackRateRef.current;
      
      const newTime = currentTime + adjustedDelta;
      
      // Auto-pause when reaching the end
      if (newTime >= projectSettings.duration) {
        setPlaying(false);
        setCurrentTime(projectSettings.duration);
      } else {
        setCurrentTime(newTime);
      }

      lastUpdateTimeRef.current = timestamp;
      
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      lastUpdateTimeRef.current = 0;
    };
  }, [isPlaying, setCurrentTime, setPlaying, projectSettings.duration]);

  // Use state for playback rate to trigger re-renders when it changes
  const [playbackRate, setPlaybackRateState] = React.useState(1);

  const setPlaybackRate = useCallback((rate: number) => {
    try {
      const clampedRate = Math.max(0.25, Math.min(4, rate)); // Clamp between 0.25x and 4x
      playbackRateRef.current = clampedRate;
      setPlaybackRateState(clampedRate);
    } catch (error) {
      console.error('PlaybackEngine: Failed to set playback rate:', error);
    }
  }, []);

  return {
    togglePlayPause,
    play,
    pause,
    stop,
    seek,
    setPlaybackRate,
    isPlaying,
    currentTime,
    duration: projectSettings.duration,
    playbackRate
  };
};