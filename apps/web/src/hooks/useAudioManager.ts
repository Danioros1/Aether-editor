import { useEffect, useRef, useCallback, useState } from 'react';
import { useCurrentTime, useIsPlaying, useTimeline, useAssetLibrary } from '../store/useAetherStore';
import { ClipType } from '@aether-editor/types';

export interface AudioManager {
  syncAudioTracks: () => void;
  setVolume: (trackId: string, volume: number) => void;
  muteTrack: (trackId: string) => void;
  getAudioContext: () => AudioContext | null;
  isAudioAvailable: boolean;
  activeAudioTracks: number;
}

interface AudioTrackState {
  [trackId: string]: {
    volume: number;
    muted: boolean;
    audioElement?: HTMLAudioElement;
    gainNode?: GainNode;
  };
}

export const useAudioManager = (): AudioManager => {
  const currentTime = useCurrentTime();
  const isPlaying = useIsPlaying();
  const timeline = useTimeline();
  const assetLibrary = useAssetLibrary();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const [audioTrackState, setAudioTrackState] = useState<AudioTrackState>({});
  const [isAudioAvailable, setIsAudioAvailable] = useState(false);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Initialize audio context
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Check for AudioContext availability
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      
      if (!AudioContextClass) {
        console.warn('AudioContext not supported in this browser');
        setIsAudioAvailable(false);
        return;
      }

      audioContextRef.current = new AudioContextClass();
      
      // Handle audio context state changes
      const handleStateChange = () => {
        if (audioContextRef.current) {
          setIsAudioAvailable(audioContextRef.current.state === 'running');
        }
      };

      audioContextRef.current.addEventListener('statechange', handleStateChange);
      handleStateChange();

      // Try to resume audio context if it's suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(error => {
          console.warn('Failed to resume AudioContext:', error);
        });
      }

    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
      setIsAudioAvailable(false);
    }

    return () => {
      // Cleanup audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(error => {
          console.warn('Error closing AudioContext:', error);
        });
      }
    };
  }, []);

  // Get audio context
  const getAudioContext = useCallback((): AudioContext | null => {
    return audioContextRef.current;
  }, []);

  // Set volume for a specific track
  const setVolume = useCallback((trackId: string, volume: number) => {
    try {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      
      setAudioTrackState(prev => ({
        ...prev,
        [trackId]: {
          ...prev[trackId],
          volume: clampedVolume
        }
      }));

      // Update gain node if it exists
      const trackState = audioTrackState[trackId];
      if (trackState?.gainNode) {
        trackState.gainNode.gain.value = trackState.muted ? 0 : clampedVolume;
      }
    } catch (error) {
      console.error('AudioManager: Failed to set volume:', error);
    }
  }, [audioTrackState]);

  // Mute/unmute a specific track
  const muteTrack = useCallback((trackId: string) => {
    try {
      setAudioTrackState(prev => {
        const currentState = prev[trackId] || { volume: 1, muted: false };
        const newMuted = !currentState.muted;
        
        // Update gain node if it exists
        if (currentState.gainNode) {
          currentState.gainNode.gain.value = newMuted ? 0 : currentState.volume;
        }

        return {
          ...prev,
          [trackId]: {
            ...currentState,
            muted: newMuted
          }
        };
      });
    } catch (error) {
      console.error('AudioManager: Failed to mute track:', error);
    }
  }, []);

  // Synchronize audio tracks with timeline
  const syncAudioTracks = useCallback(() => {
    if (!audioContextRef.current || !isAudioAvailable) {
      return;
    }

    try {
      // Get all audio clips from timeline
      const audioClips: ClipType[] = [];
      timeline.audioTracks.forEach(track => {
        audioClips.push(...track);
      });

      // Process each audio clip
      audioClips.forEach(clip => {
        const asset = assetLibrary.find(a => a.assetId === clip.assetId);
        if (!asset || asset.type !== 'audio') {
          return;
        }

        // Check if audio element already exists
        let audioElement = audioElementsRef.current.get(clip.clipId);
        
        if (!audioElement) {
          // Create new audio element
          audioElement = new Audio();
          audioElement.src = asset.sourceUrl || '';
          audioElement.preload = 'metadata';
          audioElementsRef.current.set(clip.clipId, audioElement);

          // Create gain node for volume control
          if (audioContextRef.current) {
            const source = audioContextRef.current.createMediaElementSource(audioElement);
            const gainNode = audioContextRef.current.createGain();
            
            source.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);

            // Initialize track state
            setAudioTrackState(prev => ({
              ...prev,
              [clip.clipId]: {
                volume: clip.volume || 1,
                muted: false,
                audioElement,
                gainNode
              }
            }));

            gainNode.gain.value = clip.volume || 1;
          }
        }

        // Sync audio element with current time and playback state
        const clipStartTime = clip.startTime;
        const clipEndTime = clip.startTime + clip.duration;
        
        if (currentTime >= clipStartTime && currentTime <= clipEndTime) {
          const audioTime = currentTime - clipStartTime;
          
          if (Math.abs(audioElement.currentTime - audioTime) > 0.1) {
            audioElement.currentTime = audioTime;
          }

          if (isPlaying && audioElement.paused) {
            audioElement.play().catch(error => {
              console.warn('Failed to play audio:', error);
            });
          } else if (!isPlaying && !audioElement.paused) {
            audioElement.pause();
          }
        } else {
          // Audio clip is not in current time range
          if (!audioElement.paused) {
            audioElement.pause();
          }
        }
      });

    } catch (error) {
      console.error('AudioManager: Failed to sync audio tracks:', error);
    }
  }, [currentTime, isPlaying, timeline.audioTracks, assetLibrary, isAudioAvailable]);

  // Handle playback state changes
  useEffect(() => {
    syncAudioTracks();
  }, [syncAudioTracks]);

  // Handle timeline changes
  useEffect(() => {
    // Clean up audio elements for clips that no longer exist
    const currentClipIds = new Set<string>();
    timeline.audioTracks.forEach(track => {
      track.forEach(clip => currentClipIds.add(clip.clipId));
    });

    // Remove audio elements for deleted clips
    audioElementsRef.current.forEach((audioElement, clipId) => {
      if (!currentClipIds.has(clipId)) {
        audioElement.pause();
        audioElement.src = '';
        audioElementsRef.current.delete(clipId);
        
        setAudioTrackState(prev => {
          const newState = { ...prev };
          delete newState[clipId];
          return newState;
        });
      }
    });
  }, [timeline.audioTracks]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Pause and cleanup all audio elements
      audioElementsRef.current.forEach(audioElement => {
        audioElement.pause();
        audioElement.src = '';
      });
      audioElementsRef.current.clear();
    };
  }, []);

  // Calculate active audio tracks
  const activeAudioTracks = timeline.audioTracks.reduce((count, track) => {
    return count + track.filter(clip => {
      const clipStartTime = clip.startTime;
      const clipEndTime = clip.startTime + clip.duration;
      return currentTime >= clipStartTime && currentTime <= clipEndTime;
    }).length;
  }, 0);

  return {
    syncAudioTracks,
    setVolume,
    muteTrack,
    getAudioContext,
    isAudioAvailable,
    activeAudioTracks
  };
};