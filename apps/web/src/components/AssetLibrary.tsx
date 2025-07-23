import React, { useRef, useState } from 'react';
import { Upload, Image, Video, Music, FileText, Plus, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton, ProgressIndicator, LoadingOverlay } from './ui/loading-spinner';
import { EnhancedTooltip, HelpTooltip, StatusTooltip } from './ui/enhanced-tooltip';
import { EmptyState, ErrorState } from './ui/feedback';
import { FadeIn, SlideIn, HoverLift, Shimmer } from './ui/animations';
import { useAetherActions, useAssetLibrary } from '../store/useAetherStore';
import { AssetType } from '@aether-editor/types';
import { API_ENDPOINTS } from '../config/api';
import { thumbnailGenerator } from '../utils/thumbnailGenerator';
import { useToast } from '../hooks/use-toast';

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
      return 10; // Default 10 seconds for videos (will be updated when we add proper duration detection)
    case 'audio':
      return 30; // Default 30 seconds for audio
    default:
      return 5;
  }
};

interface AssetCardProps {
  asset: AssetType;
  onSelect: (assetId: string) => void;
  onUploadForPlaceholder?: (assetId: string) => void;
  isSelected: boolean;
  isLoading?: boolean;
  uploadProgress?: number;
}

const AssetCard: React.FC<AssetCardProps> = ({ 
  asset, 
  onSelect, 
  onUploadForPlaceholder, 
  isSelected, 
  isLoading = false,
  uploadProgress 
}) => {
  const handleDragStart = (event: React.DragEvent) => {
    // Don't allow dragging placeholder assets
    if (asset.isPlaceholder) {
      event.preventDefault();
      return;
    }
    
    // Store the asset data for the drop handler
    event.dataTransfer.setData('application/json', JSON.stringify(asset));
    event.dataTransfer.effectAllowed = 'copy';
  };

  const handleClick = () => {
    if (asset.isPlaceholder && onUploadForPlaceholder) {
      onUploadForPlaceholder(asset.assetId);
    } else {
      onSelect(asset.assetId);
    }
  };

  // Render placeholder asset card
  if (asset.isPlaceholder) {
    return (
      <FadeIn>
        <HoverLift>
          <EnhancedTooltip
            content={`Upload a ${asset.type} file to replace this placeholder`}
            title="Placeholder Asset"
            icon="info"
            variant="warning"
          >
            <Card 
              className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-dashed border-2 border-orange-300 bg-orange-50/50 ${
                isSelected ? 'ring-2 ring-orange-500 shadow-md' : ''
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:border-orange-400'}`}
              onClick={isLoading ? undefined : handleClick}
            >
              <CardContent className="p-4">
                <div className="flex flex-col items-center space-y-2">
                  {/* Placeholder Icon */}
                  <div className="w-16 h-16 flex items-center justify-center bg-orange-100 rounded border-2 border-dashed border-orange-300 relative overflow-hidden">
                    {isLoading && <Shimmer className="absolute inset-0" />}
                    <div className="relative z-10">
                      {getAssetIcon(asset.type)}
                      <Plus className="w-4 h-4 absolute -bottom-1 -right-1 bg-orange-500 text-white rounded-full p-0.5" />
                    </div>
                  </div>
                  
                  {/* Upload Progress */}
                  {isLoading && uploadProgress !== undefined && (
                    <div className="w-full">
                      <ProgressIndicator 
                        value={uploadProgress} 
                        variant="warning"
                        size="sm"
                        text="Uploading..."
                        showPercentage={true}
                      />
                    </div>
                  )}
                  
                  {/* Placeholder Info */}
                  <div className="text-center w-full">
                    <div className="text-sm font-medium truncate text-orange-700" title={asset.fileName}>
                      {asset.fileName}
                    </div>
                    <Badge variant="outline" className="text-xs border-orange-300 text-orange-600 bg-orange-50 mt-1">
                      Placeholder
                    </Badge>
                    {asset.placeholderDescription && (
                      <div className="text-xs text-orange-600 mt-1 truncate" title={asset.placeholderDescription}>
                        {asset.placeholderDescription}
                      </div>
                    )}
                    {!isLoading && (
                      <div className="text-xs text-orange-600 mt-1 font-medium">
                        Click to upload
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </EnhancedTooltip>
        </HoverLift>
      </FadeIn>
    );
  }

  // Render normal asset card
  return (
    <FadeIn>
      <HoverLift>
        <EnhancedTooltip
          content={
            <div className="space-y-1">
              <p>Drag to timeline or click to select</p>
              <div className="text-xs opacity-75">
                Type: {asset.type} • Duration: {asset.duration}s
              </div>
            </div>
          }
          title={asset.fileName}
          icon={asset.thumbnailUrl ? "success" : "info"}
          variant="secondary"
        >
          <Card 
            className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
              isSelected ? 'ring-2 ring-primary shadow-md' : ''
            } ${isLoading ? 'opacity-50' : 'hover:scale-[1.02]'}`}
            onClick={handleClick}
            draggable={!isLoading && !asset.isPlaceholder}
            onDragStart={isLoading ? undefined : handleDragStart}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center space-y-2">
                {/* Asset Thumbnail or Icon */}
                <div className="w-16 h-16 flex items-center justify-center bg-muted rounded overflow-hidden relative">
                  {isLoading && <Shimmer className="absolute inset-0 z-10" />}
                  {asset.thumbnailUrl ? (
                    <img 
                      src={asset.thumbnailUrl} 
                      alt={asset.fileName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to icon if thumbnail fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <Skeleton className="w-full h-full" />
                  )}
                  <div className={`text-muted-foreground ${asset.thumbnailUrl ? 'hidden' : ''}`}>
                    {getAssetIcon(asset.type)}
                  </div>
                  
                  {/* Processing indicator */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <div className="bg-white rounded-full p-1">
                        <RefreshCw className="w-3 h-3 animate-spin text-primary" />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Upload Progress */}
                {isLoading && uploadProgress !== undefined && (
                  <div className="w-full">
                    <ProgressIndicator 
                      value={uploadProgress} 
                      variant="default"
                      size="sm"
                      text="Processing..."
                      showPercentage={true}
                    />
                  </div>
                )}
                
                {/* Asset Info */}
                <div className="text-center w-full">
                  <div className="text-sm font-medium truncate" title={asset.fileName}>
                    {asset.fileName}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize flex items-center justify-center gap-1 mt-1">
                    {asset.type}
                    {asset.thumbnailUrl && (
                      <StatusTooltip status="success" message="Thumbnail generated successfully">
                        <CheckCircle className="w-3 h-3 text-green-500" />
                      </StatusTooltip>
                    )}
                    {isLoading && (
                      <StatusTooltip status="info" message="Processing asset...">
                        <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />
                      </StatusTooltip>
                    )}
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
        </EnhancedTooltip>
      </HoverLift>
    </FadeIn>
  );
};

interface AssetLibraryProps {
  className?: string;
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({ className }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingAssets, setProcessingAssets] = useState<Set<string>>(new Set());
  const [uploadProgress] = useState<Record<string, number>>({});
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const assetLibrary = useAssetLibrary();
  const { addAsset, updateAsset } = useAetherActions();
  const { toast } = useToast();

  // Simulate initial loading state
  React.useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Retry upload function
  const retryUpload = async (file: File, assetId: string) => {
    const currentRetries = retryCount[assetId] || 0;
    if (currentRetries >= 3) {
      toast({
        title: "Upload Failed",
        description: `Failed to upload ${file.name} after 3 attempts.`,
        variant: "destructive",
      });
      return;
    }

    setRetryCount(prev => ({ ...prev, [assetId]: currentRetries + 1 }));
    
    toast({
      title: "Retrying Upload",
      description: `Attempting to upload ${file.name} again (${currentRetries + 1}/3)...`,
      variant: "warning",
    });

    // Re-attempt the upload
    await handleSingleFileUpload(file, assetId);
  };

  // Handle single file upload with error handling
  const handleSingleFileUpload = async (file: File, assetId?: string) => {
    const finalAssetId = assetId || generateAssetId();
    const assetType = getAssetTypeFromFile(file);
    
    try {
      setProcessingAssets(prev => new Set(prev).add(finalAssetId));

      // Upload to backend API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assetId', finalAssetId);

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
        throw new Error(errorData.message || 'Upload failed');
      }

      // Create asset object
      const asset: AssetType = {
        assetId: finalAssetId,
        fileName: file.name,
        type: assetType,
        sourceUrl,
        duration: getDefaultDuration(assetType),
        isPlaceholder: false
      };

      // Add asset to store immediately
      if (!assetId) {
        addAsset(asset);
      } else {
        updateAsset(finalAssetId, asset);
      }

      // Generate thumbnail in background
      try {
        const thumbnailResult = await thumbnailGenerator.generateThumbnail({
          assetId: finalAssetId,
          file,
          assetType
        });

        // Update asset with thumbnail and metadata
        const updateData: any = {
          thumbnailUrl: thumbnailResult.thumbnailUrl,
          duration: thumbnailResult.duration
        };
        
        if (assetType === 'video' && thumbnailResult.filmstripUrl) {
          updateData.filmstripUrl = thumbnailResult.filmstripUrl;
          updateData.filmstripFrameCount = thumbnailResult.filmstripFrameCount;
          updateData.filmstripFrameWidth = thumbnailResult.filmstripFrameWidth;
          updateData.filmstripFrameHeight = thumbnailResult.filmstripFrameHeight;
        }
        
        updateAsset(finalAssetId, updateData);
        
        toast({
          title: "Asset Ready",
          description: `${file.name} has been processed successfully.`,
          variant: "success",
        });

      } catch (thumbnailError) {
        console.warn('Thumbnail generation failed:', thumbnailError);
        
        // Try fallback thumbnail generation
        try {
          const fallbackResult = await thumbnailGenerator.generateFallbackThumbnail(file, assetType);
          updateAsset(finalAssetId, {
            thumbnailUrl: fallbackResult.thumbnailUrl,
            duration: fallbackResult.duration
          });
        } catch (fallbackError) {
          console.warn('Fallback thumbnail generation also failed:', fallbackError);
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      
      // Show error with retry option
      toast({
        title: "Upload Error",
        description: `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Network error'}`,
        variant: "destructive",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => retryUpload(file, finalAssetId)}
            disabled={uploading}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        ),
      });

      // Create fallback asset for development
      const fallbackAsset: AssetType = {
        assetId: finalAssetId,
        fileName: file.name,
        type: assetType,
        sourceUrl: URL.createObjectURL(file),
        duration: getDefaultDuration(assetType),
        isPlaceholder: false
      };

      if (!assetId) {
        addAsset(fallbackAsset);
      } else {
        updateAsset(finalAssetId, fallbackAsset);
      }

    } finally {
      setProcessingAssets(prev => {
        const newSet = new Set(prev);
        newSet.delete(finalAssetId);
        return newSet;
      });
    }
  };

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    setUploading(true);
    setUploadError(null);

    try {
      // Process files one by one with enhanced error handling
      // Process files one by one with enhanced error handling
      const uploadPromises = Array.from(files).map(file => handleSingleFileUpload(file));
      await Promise.allSettled(uploadPromises);
      
      toast({
        title: "Upload Complete",
        description: `Processed ${files.length} file${files.length > 1 ? 's' : ''} successfully.`,
        variant: "success",
      });
      
    } catch (error) {
      console.error('Batch upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Upload failed');
      
      toast({
        title: "Upload Error",
        description: "Some files failed to upload. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle file input change
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag and drop
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFileSelect(event.dataTransfer.files);
  };

  // Handle add asset button click
  const handleAddAssetClick = () => {
    fileInputRef.current?.click();
  };

  // Handle asset selection
  const handleAssetSelect = (assetId: string) => {
    setSelectedAssetId(selectedAssetId === assetId ? null : assetId);
  };

  // Handle placeholder asset upload
  const handleUploadForPlaceholder = async (placeholderAssetId: string) => {
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
  };

  return (
    <div className={`flex flex-col h-full ${className}`} role="region" aria-label="Asset library" aria-describedby="asset-library-instructions">
      {/* Screen reader instructions */}
      <div id="asset-library-instructions" className="sr-only">
        Asset library containing {assetLibrary.length} media files. 
        Upload new assets using the upload button or drag and drop files. 
        Drag assets to the timeline to add them to your project.
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Asset Library</h2>
          <HelpTooltip
            title="Asset Library"
            description="Upload and manage your media files. Drag assets to the timeline to use them in your project."
            shortcut="Drag & Drop"
          >
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <AlertCircle className="h-3 w-3" />
            </Button>
          </HelpTooltip>
        </div>
        <StatusTooltip 
          status={assetLibrary.length > 0 ? "success" : "info"} 
          message={`${assetLibrary.length} assets in your library`}
        >
          <Badge variant="secondary" className="text-xs">
            {assetLibrary.length} assets
          </Badge>
        </StatusTooltip>
      </div>

      {/* Add Asset Button */}
      <HelpTooltip
        title="Upload Assets"
        description="Upload images, videos, and audio files to use in your project. Supports drag and drop."
        shortcut="Click or Drag & Drop"
      >
        <Button 
          onClick={handleAddAssetClick}
          className="mb-4 w-full transition-all duration-200"
          variant="default"
          disabled={uploading}
          aria-describedby="add-asset-desc"
        >
          <Upload className={`w-4 h-4 mr-2 ${uploading ? 'animate-pulse' : ''}`} aria-hidden="true" />
          {uploading ? 'Uploading...' : 'Add Asset'}
        </Button>
      </HelpTooltip>
      <div id="add-asset-desc" className="sr-only">
        Upload image, video, or audio files to use in your project
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="mb-4">
          <ErrorState
            title="Upload Failed"
            description={uploadError}
            onRetry={() => {
              setUploadError(null);
              handleAddAssetClick();
            }}
            retryText="Try Again"
            showDetails={true}
            error={uploadError}
          />
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
        className={`border-2 border-dashed rounded-lg p-6 mb-4 text-center transition-all duration-200 ${
          dragOver 
            ? 'border-primary bg-primary/10 scale-[1.02] shadow-md' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/20'
        } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="region"
        aria-label="File drop zone"
        aria-describedby="drop-zone-desc"
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 text-muted-foreground transition-transform duration-200 ${
          dragOver ? 'scale-110 text-primary' : ''
        } ${uploading ? 'animate-pulse' : ''}`} aria-hidden="true" />
        <p className={`text-sm transition-colors duration-200 ${
          dragOver ? 'text-primary font-medium' : 'text-muted-foreground'
        }`}>
          {dragOver ? 'Drop files to upload' : 'Drop files here or click "Add Asset" to upload'}
        </p>
        <p id="drop-zone-desc" className="text-xs text-muted-foreground mt-1">
          Supports images, videos, and audio files
        </p>
        {uploading && (
          <div className="mt-3">
            <div className="inline-flex items-center gap-2 text-xs text-primary">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Processing uploads...
            </div>
          </div>
        )}
      </div>

      {/* Asset Grid */}
      <LoadingOverlay isLoading={isInitialLoading} text="Loading asset library...">
        <div className="flex-1 overflow-y-auto" role="region" aria-label="Asset grid">
          {isInitialLoading ? (
            // Loading skeleton
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="p-4">
                  <CardContent className="p-0">
                    <div className="flex flex-col items-center gap-2">
                      <Skeleton className="w-16 h-16 rounded" />
                      <Skeleton className="w-20 h-4" />
                      <Skeleton className="w-16 h-3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : assetLibrary.length === 0 ? (
            <EmptyState
              title="No assets yet"
              description="Upload images, videos, and audio files to get started with your project."
              icon={<FileText className="w-12 h-12 opacity-50" />}
              action={
                <Button onClick={handleAddAssetClick} variant="outline" disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Asset
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-3" role="grid" aria-label="Asset library grid">
              {assetLibrary.map((asset, index) => (
                <SlideIn key={asset.assetId} delay={index * 50} direction="up">
                  <AssetCard
                    asset={asset}
                    onSelect={handleAssetSelect}
                    onUploadForPlaceholder={handleUploadForPlaceholder}
                    isSelected={selectedAssetId === asset.assetId}
                    isLoading={processingAssets.has(asset.assetId)}
                    uploadProgress={uploadProgress[asset.assetId]}
                  />
                </SlideIn>
              ))}
            </div>
          )}
        </div>
      </LoadingOverlay>
    </div>
  );
};