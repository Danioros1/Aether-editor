// Export all schemas
export {
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

// Export all types
export type {
  ProjectSettingsType,
  AssetType,
  AnimationType,
  TransitionType,
  TextOverlayType,
  ClipType,
  TimelineType,
  AetherProjectType,
  ExportSettingsType,
  RenderJobType,
  AssetLibraryType,
  VideoTrackType,
  AudioTrackType,
  PartialAssetType,
  PartialClipType,
  PartialProjectSettingsType,
  AssetTypeEnum,
  AnimationTypeEnum,
  TransitionTypeEnum,
  ResolutionEnum,
  FormatEnum,
  QualityEnum,
  VideoCodecEnum,
  AudioCodecEnum
} from './types.js';

// Re-export zod for convenience
export { z } from 'zod';