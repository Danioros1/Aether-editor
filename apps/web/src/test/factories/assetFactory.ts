import { AssetType } from '@aether-editor/types';

export interface AssetFactoryOptions {
  assetId?: string;
  fileName?: string;
  type?: AssetType['type'];
  sourceUrl?: string;
  thumbnailUrl?: string;
  filmstripUrl?: string;
  duration?: number;
  isPlaceholder?: boolean;
  placeholderDescription?: string;
}

let assetCounter = 0;

export const createMockAsset = (options: AssetFactoryOptions = {}): AssetType => {
  const id = options.assetId || `test-asset-${++assetCounter}`;
  const type = options.type || 'video';
  const fileName = options.fileName || `test-${type}-${assetCounter}.${type === 'video' ? 'mp4' : 'jpg'}`;
  
  const baseAsset: AssetType = {
    assetId: id,
    fileName,
    type,
    sourceUrl: options.sourceUrl || `http://localhost:3001/uploads/${fileName}`,
    duration: options.duration || (type === 'video' ? 10 : 5),
    isPlaceholder: options.isPlaceholder || false
  };

  // Add type-specific properties
  if (type === 'video') {
    baseAsset.thumbnailUrl = options.thumbnailUrl || `http://localhost:3001/uploads/${fileName.replace('.mp4', '-thumb.jpg')}`;
    baseAsset.filmstripUrl = options.filmstripUrl || `http://localhost:3001/uploads/${fileName.replace('.mp4', '-filmstrip.jpg')}`;
  } else if (type === 'image') {
    baseAsset.thumbnailUrl = options.thumbnailUrl || `http://localhost:3001/uploads/${fileName.replace('.jpg', '-thumb.jpg')}`;
  }

  // Add placeholder properties if needed
  if (baseAsset.isPlaceholder) {
    baseAsset.placeholderDescription = options.placeholderDescription || `A ${type} placeholder`;
  }

  return baseAsset;
};

export const createMockVideoAsset = (options: Omit<AssetFactoryOptions, 'type'> = {}): AssetType => {
  return createMockAsset({ ...options, type: 'video' });
};

export const createMockImageAsset = (options: Omit<AssetFactoryOptions, 'type'> = {}): AssetType => {
  return createMockAsset({ ...options, type: 'image' });
};

export const createMockAudioAsset = (options: Omit<AssetFactoryOptions, 'type'> = {}): AssetType => {
  return createMockAsset({ ...options, type: 'audio' });
};

export const createMockPlaceholderAsset = (options: AssetFactoryOptions = {}): AssetType => {
  return createMockAsset({ 
    ...options, 
    isPlaceholder: true,
    placeholderDescription: options.placeholderDescription || 'AI generated placeholder'
  });
};

export const createMockAssetLibrary = (count: number = 5): AssetType[] => {
  const assets: AssetType[] = [];
  
  for (let i = 0; i < count; i++) {
    const type = i % 3 === 0 ? 'video' : i % 3 === 1 ? 'image' : 'audio';
    assets.push(createMockAsset({ type: type as AssetType['type'] }));
  }
  
  return assets;
};

export const resetAssetCounter = () => {
  assetCounter = 0;
};