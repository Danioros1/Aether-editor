import { z } from 'zod';

// Project Settings Schema
export const ProjectSettingsSchema = z.object({
  name: z.string(),
  resolution: z.enum(['1080p', '4K']),
  fps: z.number().default(30),
  duration: z.number()
});

// Asset Schema
export const AssetSchema = z.object({
  assetId: z.string(),
  fileName: z.string(),
  type: z.enum(['image', 'video', 'audio']),
  sourceUrl: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  filmstripUrl: z.string().optional(), // For video assets - tiled filmstrip image
  filmstripFrameCount: z.number().optional(), // Number of frames in filmstrip
  filmstripFrameWidth: z.number().optional(), // Width of each frame in filmstrip
  filmstripFrameHeight: z.number().optional(), // Height of each frame in filmstrip
  duration: z.number().optional(),
  isPlaceholder: z.boolean().default(false),
  placeholderDescription: z.string().optional()
});

// Animation Schema
export const AnimationSchema = z.object({
  type: z.enum(['ken_burns']),
  startRect: z.object({
    x: z.number(),
    y: z.number(),
    scale: z.number()
  }),
  endRect: z.object({
    x: z.number(),
    y: z.number(),
    scale: z.number()
  })
});

// Transition Schema
export const TransitionSchema = z.object({
  type: z.enum(['cross_dissolve']),
  duration: z.number()
});

// Text Overlay Schema
export const TextOverlaySchema = z.object({
  text: z.string(),
  startTime: z.number(),
  duration: z.number(),
  position: z.object({ 
    x: z.number(), 
    y: z.number() 
  })
});

// Clip Schema
export const ClipSchema = z.object({
  clipId: z.string(),
  assetId: z.string(),
  startTime: z.number(),
  duration: z.number(),
  volume: z.number().default(1),
  animation: AnimationSchema.optional(),
  transition: TransitionSchema.optional(),
  textOverlays: z.array(TextOverlaySchema).default([])
});

// Timeline Schema
export const TimelineSchema = z.object({
  videoTracks: z.array(z.array(ClipSchema)),
  audioTracks: z.array(z.array(ClipSchema))
});

// Master Aether Project Schema
export const AetherProjectSchema = z.object({
  projectSettings: ProjectSettingsSchema,
  assetLibrary: z.array(AssetSchema),
  timeline: TimelineSchema,
  selectedClipId: z.string().nullable().default(null),
  selectedClipIds: z.array(z.string()).default([]), // Multi-select support
  currentTime: z.number().default(0),
  isPlaying: z.boolean().default(false),
  timelineScale: z.number().default(50)
});

// Export Settings Schema (for rendering)
export const ExportSettingsSchema = z.object({
  resolution: z.enum(['720p', '1080p', '4K']),
  format: z.enum(['mp4', 'mov', 'webm']),
  quality: z.enum(['low', 'medium', 'high', 'ultra']).default('high'),
  fps: z.number().min(15).max(60).default(30),
  videoBitrate: z.string().optional(), // e.g., "5000k", "10M"
  audioBitrate: z.string().optional(), // e.g., "128k", "320k"
  videoCodec: z.enum(['h264', 'h265', 'vp9']).default('h264'),
  audioCodec: z.enum(['aac', 'mp3', 'opus']).default('aac')
});

// Render Job Schema
export const RenderJobSchema = z.object({
  projectData: AetherProjectSchema,
  exportSettings: ExportSettingsSchema,
  jobId: z.string()
});