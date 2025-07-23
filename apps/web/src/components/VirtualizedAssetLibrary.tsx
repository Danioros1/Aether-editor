import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Upload, Image, Video, Music, FileText, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { useAetherActions, useAssetLibrary } from '../store/useAetherStore';
import { AssetType } from '@aether-editor/types';
import { API_ENDPOINTS } from '../config/api';
import { thumbnailGenerator } from '../utils/thumbnailGenerator';
import { performanceMonitor } from '../utils/performanceMonitor';

// Virtual scrolling configuration
const ITEM_HEIGHT = 120; // Height of each asset card
const ITEMS_PER_ROW = 2; // Number of items per row
const OVERSCAN = 5; // Number of items to render outside visible area
const CONTAINER_PADDING = 16; // Padding around the container

// Generate unique ID for assets
const generateAssetId = () => `asset-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Get asset type from file
const getAssetTypeFromFile = (file: File): 'image' | 'video' | 'audio' => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image'; // Default fallback
};

// Get asset icon based on type
const getAssetIcon = (type: 'image' | 'video' | 'audio') => {
  switch (type) {
    case 'image':
      return <Image className="w-8 h-8" />;
    case 'video':
      return <Video className="w-8 h-8" />;
    case 'audio':
      return <Music className="w-8 h-8" />;
    default:
      return <FileText className="w-8 h-8" />;
  }
};

// Get default duration based on asset type
const getDefaultDuration = (type: 'image' | 'video' | 'audio'): number => {
  switch (type) {
    case 'image':
      return 5; // 5 seconds for images
    case 'video':
      return 10; // Default 10 seconds for videos
    case 'audio':
      return 30; // Default 30 seconds for audio
    default:
      return 5;
  }
};

interface VirtualizedAssetCardProps {
  asset: AssetType;
  onSelect: (assetId: string) => void;
  onUploadForPlaceholder?: (assetId: string) => void;
  isSelected: boolean;
  style: React.CSSProperties;
}

const VirtualizedAssetCard: React.FC<VirtualizedAssetCardProps> = React.memo(({ 
  asset, 
  onSelect, 
  onUploadForPlaceholder, 
  isSelected, 
  style 
}) => {
  const [imageError, setImageError] = useState(false);

  const handleDragStart = useCallback((event: React.DragEvent) => {
    // Don't allow dragging placeholder assets
    if (asset.isPlaceholder) {
      event.preventDefault();
      return;
    }
    
    // Store the asset data for the drop handler
    event.dataTransfer.setData('application/json', JSON.stringify(asset));
    event.dataTransfer.effectAllowed = 'copy';
  }, [asset]);

  const handleClick = useCallback(() => {
    if (asset.isPlaceholder && onUploadForPlaceholder) {
      onUploadForPlaceholder(asset.assetId);
    } else {
      onSelect(asset.assetId);
    }
  }, [asset.assetId, asset.isPlaceholder, onSelect, onUploadForPlaceholder]);

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Render placeholder asset card
  if (asset.isPlaceholder) {
    return (
      <div style={style} className="p-1">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md border-dashed border-2 border-orange-300 bg-orange-50/50 h-full ${
            isSelected ? 'ring-2 ring-orange-500' : ''
          }`}
          onClick={handleClick}
        >
          <CardContent className="p-3 h-full">
            <div className="flex flex-col items-center space-y-2 h-full justify-center">
              {/* Placeholder Icon */}
              <div className="w-12 h-12 flex items-center justify-center bg-orange-100 rounded border-2 border-dashed border-orange-300">
                <div className="relative">
                  {getAssetIcon(asset.type)}
                  <Plus className="w-3 h-3 absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-full p-0.5" />
                </div>
              </div>
              
              {/* Placeholder Info */}
              <div className="text-center w-full">
                <div className="text-xs font-medium truncate text-orange-700" title={asset.fileName}>
                  {asset.fileName}
                </div>
                <Badge variant="outline" className="text-xs border-orange-300 text-orange-600 bg-orange-50">
                  Placeholder
                </Badge>
                {asset.placeholderDescription && (
                  <div className="text-xs text-orange-600 mt-1 truncate" title={asset.placeholderDescription}>
                    {asset.placeholderDescription}
                  </div>
                )}
                <div className="text-xs text-orange-600 mt-1 font-medium">
                  Click to upload
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render normal asset card
  return (
    <div style={style} className="p-1">
      <Card 
        className={`cursor-pointer transition-all hover:shadow-md h-full ${
          isSelected ? 'ring-2 ring-primary' : ''
        }`}
        onClick={handleClick}
        draggable
        onDragStart={handleDragStart}
      >
        <CardContent className="p-3 h-full">
          <div className="flex flex-col items-center space-y-2 h-full">
            {/* Asset Thumbnail or Icon */}
            <div className="w-12 h-12 flex items-center justify-center bg-muted rounded overflow-hidden flex-shrink-0">
              {asset.thumbnailUrl && !imageError ? (
                <img 
                  src={asset.thumbnailUrl} 
                  alt={asset.fileName}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                  loading="lazy"
                />
              ) : (
                <div className="text-muted-foreground">
                  {getAssetIcon(asset.type)}
                </div>
              )}
            </div>
            
            {/* Asset Info */}
            <div className="text-center w-full flex-1 flex flex-col justify-center">
              <div className="text-xs font-medium truncate" title={asset.fileName}>
                {asset.fileName}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {asset.type}
              </div>
              {asset.duration && (
                <div className="text-xs text-muted-foreground">
                  {asset.duration}s
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

VirtualizedAssetCard.displayName = 'VirtualizedAssetCard';

interface VirtualizedAssetLibraryProps {
  className?: string;
}

export const VirtualizedAssetLibrary: React.FC<VirtualizedAssetLibraryProps> = ({ className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);
  
  const assetLibrary = useAssetLibrary();
  const { addAsset, updateAsset } = useAetherActions();

  // Calculate virtual scrolling parameters
  const { visibleItems, totalHeight, startIndex } = useMemo(() => {
    const totalItems = assetLibrary.length;
    const rowHeight = ITEM_HEIGHT + 8; // Include padding
    const totalRows = Math.ceil(totalItems / ITEMS_PER_ROW);
    const totalHeight = totalRows * rowHeight + CONTAINER_PADDING * 2;
    
    const visibleRows = Math.ceil(containerHeight / rowHeight);
    const startRow = Math.floor(scrollTop / rowHeight);
    const endRow = Math.min(startRow + visibleRows + OVERSCAN, totalRows);
    
    const startIndex = Math.max(0, startRow * ITEMS_PER_ROW);
    const endIndex = Math.min(endRow * ITEMS_PER_ROW, totalItems);
    
    const visibleItems = assetLibrary.slice(startIndex, endIndex);
    
    return { visibleItems, totalHeight, startIndex, endIndex };
  }, [assetLibrary, scrollTop, containerHeight]);

  // Handle container resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerHeight(rect.height);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  // Performance monitoring for asset library rendering
  useEffect(() => {
    const handlePerformanceCleanup = (event: CustomEvent) => {
      const { severity } = event.detail;
      
      if (severity === 'critical') {
        // Force cleanup of unused thumbnails
        console.log('VirtualizedAssetLibrary: Performing critical performance cleanup');
        
        // Clear thumbnail cache for non-visible items
        const visibleAssetIds = new Set(visibleItems.map(asset => asset.assetId));
        assetLibrary.forEach(asset => {
          if (!visibleAssetIds.has(asset.assetId) && asset.thumbnailUrl?.startsWith('blob:')) {
            // Revoke blob URLs for non-visible items to free memory
            URL.revokeObjectURL(asset.thumbnailUrl);
          }
        });
      }
    };

    window.addEventListener('performance:memoryCleanup', handlePerformanceCleanup as EventListener);
    return () => window.removeEventListener('performance:memoryCleanup', handlePerformanceCleanup as EventListener);
  }, [visibleItems, assetLibrary]);

  // Handle file selection with performance monitoring
  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files) return;

    setUploading(true);
    setUploadError(null);

    try {
      await performanceMonitor.measureAsyncComponentRender('assetLibraryRenderTime', async () => {
        // Process files one by one
        for (const file of Array.from(files)) {
          const assetId = generateAssetId();
          const assetType = getAssetTypeFromFile(file);
          
          try {
            // First, upload file to backend API
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(API_ENDPOINTS.upload, {
              method: 'POST',
              body: formData,
            });

            let sourceUrl: string;

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.asset) {
                sourceUrl = result.asset.sourceUrl;
              } else {
                throw new Error('Invalid response from server');
              }
            } else {
              const errorData = await response.json();
              console.error('Upload failed:', errorData);
              throw new Error(errorData.message || 'Upload failed');
            }

            // Create initial asset with basic info
            const initialAsset: AssetType = {
              assetId,
              fileName: file.name,
              type: assetType,
              sourceUrl,
              duration: getDefaultDuration(assetType),
              isPlaceholder: false
            };

            // Add asset to store immediately so user sees it
            addAsset(initialAsset);

            // Generate thumbnail in background
            try {
              const thumbnailResult = await thumbnailGenerator.generateThumbnail({
                assetId,
                file,
                assetType
              });

              // Update asset with thumbnail, filmstrip (for videos), and accurate duration
              const updateData: any = {
                thumbnailUrl: thumbnailResult.thumbnailUrl,
                duration: thumbnailResult.duration
              };
              
              // Add filmstrip data for video assets
              if (assetType === 'video' && thumbnailResult.filmstripUrl) {
                updateData.filmstripUrl = thumbnailResult.filmstripUrl;
                updateData.filmstripFrameCount = thumbnailResult.filmstripFrameCount;
                updateData.filmstripFrameWidth = thumbnailResult.filmstripFrameWidth;
                updateData.filmstripFrameHeight = thumbnailResult.filmstripFrameHeight;
              }
              
              updateAsset(assetId, updateData);

            } catch (thumbnailError) {
              console.warn('Thumbnail generation failed, using fallback:', thumbnailError);
              
              // Try fallback thumbnail generation
              try {
                const fallbackResult = await thumbnailGenerator.generateFallbackThumbnail(file, assetType);
                updateAsset(assetId, {
                  thumbnailUrl: fallbackResult.thumbnailUrl,
                  duration: fallbackResult.duration
                });
              } catch (fallbackError) {
                console.warn('Fallback thumbnail generation also failed:', fallbackError);
                // Asset remains without thumbnail
              }
            }

          } catch (error) {
            console.error('Upload error:', error);
            setUploadError(`Upload failed for ${file.name}: ${error instanceof Error ? error.message : 'Network error'}`);
            
            // Fallback to object URL for development
            const sourceUrl = URL.createObjectURL(file);
            
            const fallbackAsset: AssetType = {
              assetId,
              fileName: file.name,
              type: assetType,
              sourceUrl,
              duration: getDefaultDuration(assetType),
              isPlaceholder: false
            };
            
            addAsset(fallbackAsset);

            // Still try to generate thumbnail for fallback asset
            try {
              const thumbnailResult = await thumbnailGenerator.generateFallbackThumbnail(file, assetType);
              updateAsset(assetId, {
                thumbnailUrl: thumbnailResult.thumbnailUrl,
                duration: thumbnailResult.duration
              });
            } catch (thumbnailError) {
              console.warn('Fallback thumbnail generation failed:', thumbnailError);
            }
          }
        }
      });
    } finally {
      setUploading(false);
    }
  }, [addAsset, updateAsset]);

  // Handle file input change
  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleFileSelect]);

  // Handle drag and drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFileSelect(event.dataTransfer.files);
  }, [handleFileSelect]);

  // Handle add asset button click
  const handleAddAssetClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Handle asset selection
  const handleAssetSelect = useCallback((assetId: string) => {
    setSelectedAssetId(selectedAssetId === assetId ? null : assetId);
  }, [selectedAssetId]);

  // Handle placeholder asset upload
  const handleUploadForPlaceholder = useCallback(async (placeholderAssetId: string) => {
    // Create a temporary file input for this specific placeholder
    const tempInput = document.createElement('input');
    tempInput.type = 'file';
    tempInput.accept = 'image/*,video/*,audio/*';
    tempInput.style.display = 'none';
    
    tempInput.onchange = async (event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      setUploading(true);
      setUploadError(null);

      try {
        const assetType = getAssetTypeFromFile(file);
        
        // Upload file to backend API
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(API_ENDPOINTS.upload, {
          method: 'POST',
          body: formData,
        });

        let sourceUrl: string;

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.asset) {
            sourceUrl = result.asset.sourceUrl;
          } else {
            throw new Error('Invalid response from server');
          }
        } else {
          const errorData = await response.json();
          console.error('Upload failed:', errorData);
          throw new Error(errorData.message || 'Upload failed');
        }

        // Update the placeholder asset with real asset data
        updateAsset(placeholderAssetId, {
          fileName: file.name,
          type: assetType,
          sourceUrl,
          duration: getDefaultDuration(assetType),
          isPlaceholder: false,
          placeholderDescription: undefined
        });

        // Generate thumbnail in background
        try {
          const thumbnailResult = await thumbnailGenerator.generateThumbnail({
            assetId: placeholderAssetId,
            file,
            assetType
          });

          // Update asset with thumbnail, filmstrip (for videos), and accurate duration
          const updateData: any = {
            thumbnailUrl: thumbnailResult.thumbnailUrl,
            duration: thumbnailResult.duration
          };
          
          // Add filmstrip data for video assets
          if (assetType === 'video' && thumbnailResult.filmstripUrl) {
            updateData.filmstripUrl = thumbnailResult.filmstripUrl;
            updateData.filmstripFrameCount = thumbnailResult.filmstripFrameCount;
            updateData.filmstripFrameWidth = thumbnailResult.filmstripFrameWidth;
            updateData.filmstripFrameHeight = thumbnailResult.filmstripFrameHeight;
          }
          
          updateAsset(placeholderAssetId, updateData);

        } catch (thumbnailError) {
          console.warn('Thumbnail generation failed, using fallback:', thumbnailError);
          
          // Try fallback thumbnail generation
          try {
            const fallbackResult = await thumbnailGenerator.generateFallbackThumbnail(file, assetType);
            updateAsset(placeholderAssetId, {
              thumbnailUrl: fallbackResult.thumbnailUrl,
              duration: fallbackResult.duration
            });
          } catch (fallbackError) {
            console.warn('Fallback thumbnail generation also failed:', fallbackError);
          }
        }

      } catch (error) {
        console.error('Placeholder upload error:', error);
        setUploadError(`Upload failed: ${error instanceof Error ? error.message : 'Network error'}`);
        
        // Fallback to object URL for development
        const sourceUrl = URL.createObjectURL(file);
        const assetType = getAssetTypeFromFile(file);
        
        updateAsset(placeholderAssetId, {
          fileName: file.name,
          type: assetType,
          sourceUrl,
          duration: getDefaultDuration(assetType),
          isPlaceholder: false,
          placeholderDescription: undefined
        });

        // Still try to generate thumbnail for fallback asset
        try {
          const thumbnailResult = await thumbnailGenerator.generateFallbackThumbnail(file, assetType);
          updateAsset(placeholderAssetId, {
            thumbnailUrl: thumbnailResult.thumbnailUrl,
            duration: thumbnailResult.duration
          });
        } catch (thumbnailError) {
          console.warn('Fallback thumbnail generation failed:', thumbnailError);
        }
      } finally {
        setUploading(false);
        document.body.removeChild(tempInput);
      }
    };

    document.body.appendChild(tempInput);
    tempInput.click();
  }, [updateAsset]);

  return (
    <div className={`flex flex-col h-full ${className}`} role="region" aria-label="Asset library" aria-describedby="virtualized-asset-library-instructions">
      {/* Screen reader instructions */}
      <div id="virtualized-asset-library-instructions" className="sr-only">
        Virtualized asset library containing {assetLibrary.length} media files. 
        This is the performance-optimized version that only renders visible items.
        Upload new assets using the upload button or drag and drop files. 
        Drag assets to the timeline to add them to your project.
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Asset Library</h2>
        <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {assetLibrary.length} assets
        </span>
      </div>

      {/* Add Asset Button */}
      <Button 
        onClick={handleAddAssetClick}
        className="mb-4 w-full"
        variant="default"
        disabled={uploading}
        aria-describedby="add-asset-desc"
      >
        <Upload className="w-4 h-4 mr-2" aria-hidden="true" />
        {uploading ? 'Uploading...' : 'Add Asset'}
      </Button>
      <div id="add-asset-desc" className="sr-only">
        Upload image, video, or audio files to use in your project
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg" role="alert">
          <p className="text-sm text-destructive">{uploadError}</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,audio/*"
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Select files to upload"
      />

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 mb-4 text-center transition-colors ${
          dragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="File drop zone"
        aria-describedby="drop-zone-desc"
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          Drop files here or click "Add Asset" to upload
        </p>
        <p id="drop-zone-desc" className="text-xs text-muted-foreground mt-1">
          Supports images, videos, and audio files
        </p>
      </div>

      {/* Virtualized Asset Grid */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto" 
        role="region" 
        aria-label="Asset grid"
        onScroll={handleScroll}
      >
        {assetLibrary.length === 0 ? (
          <div className="text-center text-muted-foreground py-8" role="status">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
            <p className="text-sm">No assets yet</p>
            <p className="text-xs">Upload some files to get started</p>
          </div>
        ) : (
          <div 
            style={{ height: totalHeight, position: 'relative' }}
            role="grid" 
            aria-label="Asset library grid"
          >
            {visibleItems.map((asset, index) => {
              const actualIndex = startIndex + index;
              const row = Math.floor(actualIndex / ITEMS_PER_ROW);
              const col = actualIndex % ITEMS_PER_ROW;
              
              const style: React.CSSProperties = {
                position: 'absolute',
                top: row * (ITEM_HEIGHT + 8) + CONTAINER_PADDING,
                left: col * 50 + '%',
                width: '50%',
                height: ITEM_HEIGHT,
              };

              return (
                <VirtualizedAssetCard
                  key={asset.assetId}
                  asset={asset}
                  onSelect={handleAssetSelect}
                  onUploadForPlaceholder={handleUploadForPlaceholder}
                  isSelected={selectedAssetId === asset.assetId}
                  style={style}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};