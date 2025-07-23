import { z } from 'zod';
import {
  ProjectSettingsSchema,
  AssetSchema,
  AnimationSchema,
  TransitionSchema,
  TextOverlaySchema,
  ClipSchema,
  TimelineSchema,
  AetherProjectSchema,
  ExportSettingsSchema,
  RenderJobSchema
} from './schemas.js';

// Inferred TypeScript types from Zod schemas
export type ProjectSettingsType = z.infer<typeof ProjectSettingsSchema>;
export type AssetType = z.infer<typeof AssetSchema>;
export type AnimationType = z.infer<typeof AnimationSchema>;
export type TransitionType = z.infer<typeof TransitionSchema>;
export type TextOverlayType = z.infer<typeof TextOverlaySchema>;
export type ClipType = z.infer<typeof ClipSchema>;
export type TimelineType = z.infer<typeof TimelineSchema>;
export type AetherProjectType = z.infer<typeof AetherProjectSchema>;
export type ExportSettingsType = z.infer<typeof ExportSettingsSchema>;
export type RenderJobType = z.infer<typeof RenderJobSchema>;

// Additional utility types for state management
export type AssetLibraryType = AssetType[];
export type VideoTrackType = ClipType[];
export type AudioTrackType = ClipType[];

// Partial types for updates
export type PartialAssetType = Partial<AssetType>;
export type PartialClipType = Partial<ClipType>;
export type PartialProjectSettingsType = Partial<ProjectSettingsType>;

// Union types for different asset and animation types
export type AssetTypeEnum = 'image' | 'video' | 'audio';
export type AnimationTypeEnum = 'ken_burns';
export type TransitionTypeEnum = 'cross_dissolve';
export type ResolutionEnum = '720p' | '1080p' | '4K';
export type FormatEnum = 'mp4' | 'mov' | 'webm';
export type QualityEnum = 'low' | 'medium' | 'high' | 'ultra';
export type VideoCodecEnum = 'h264' | 'h265' | 'vp9';
export type AudioCodecEnum = 'aac' | 'mp3' | 'opus';