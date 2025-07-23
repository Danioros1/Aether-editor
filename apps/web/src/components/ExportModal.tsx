import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { LoadingSpinner } from './ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';


import { CheckCircle, XCircle, Clock, Download, AlertCircle, Settings, Zap, Film, RefreshCw } from 'lucide-react';
import { useAetherStore } from '../store/useAetherStore';
import { ExportSettingsType } from '@aether-editor/types';
import { useToast } from '../hooks/use-toast';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ExportJob {
  jobId: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
  progress: number;
  createdAt: string;
  processedAt?: string;
  finishedAt?: string;
  downloadUrl?: string;
  failedReason?: string;
  data?: any;
}

export function ExportModal({ open, onOpenChange }: ExportModalProps) {
  const [exportSettings, setExportSettings] = useState<ExportSettingsType>({
    resolution: '1080p',
    format: 'mp4',
    quality: 'high',
    fps: 30,
    videoCodec: 'h264',
    audioCodec: 'aac'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [_exportError, setExportError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get the current project state and toast
  const projectState = useAetherStore();
  const { toast } = useToast();

  // Cleanup polling interval on unmount or modal close
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Stop polling when modal closes
  useEffect(() => {
    if (!open && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, [open]);

  // Validate export settings
  const validateExportSettings = (): string[] => {
    const errors: string[] = [];

    // Validate bitrate formats
    if (exportSettings.videoBitrate) {
      const videoBitrateRegex = /^\d+[kKmM]?$/;
      if (!videoBitrateRegex.test(exportSettings.videoBitrate)) {
        errors.push('Video bitrate must be in format like "5000k" or "10M"');
      }
    }

    if (exportSettings.audioBitrate) {
      const audioBitrateRegex = /^\d+[kKmM]?$/;
      if (!audioBitrateRegex.test(exportSettings.audioBitrate)) {
        errors.push('Audio bitrate must be in format like "128k" or "320k"');
      }
    }

    // Validate codec compatibility
    if (exportSettings.format === 'webm' && exportSettings.videoCodec !== 'vp9') {
      errors.push('WebM format requires VP9 video codec');
    }

    if (exportSettings.format === 'webm' && exportSettings.audioCodec !== 'opus') {
      errors.push('WebM format requires Opus audio codec');
    }

    if (exportSettings.format !== 'webm' && exportSettings.videoCodec === 'vp9') {
      errors.push('VP9 codec is only supported with WebM format');
    }

    if (exportSettings.format !== 'webm' && exportSettings.audioCodec === 'opus') {
      errors.push('Opus codec is only supported with WebM format');
    }

    // Validate project has content
    const hasVideoClips = projectState.timeline.videoTracks.some(track => track.length > 0);
    const hasAudioClips = projectState.timeline.audioTracks.some(track => track.length > 0);
    
    if (!hasVideoClips && !hasAudioClips) {
      errors.push('Project must contain at least one video or audio clip');
    }

    return errors;
  };

  // Update validation errors when settings change
  useEffect(() => {
    const errors = validateExportSettings();
    setValidationErrors(errors);
  }, [exportSettings, projectState.timeline]);

  // Retry export function
  const retryExport = async () => {
    if (retryCount >= 3) {
      toast({
        title: "Export Failed",
        description: "Failed to export after 3 attempts. Please try again later.",
        variant: "destructive",
      });
      return;
    }

    setRetryCount(prev => prev + 1);
    setExportError(null);
    
    toast({
      title: "Retrying Export",
      description: `Attempting to export again (${retryCount + 1}/3)...`,
      variant: "warning",
    });

    await handleExport();
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportJob(null);
    setExportError(null);

    try {
      // Prepare project data for export (exclude UI state)
      const projectData = {
        projectSettings: projectState.projectSettings,
        assetLibrary: projectState.assetLibrary,
        timeline: projectState.timeline,
        selectedClipId: null, // Don't include UI state
        currentTime: 0,
        isPlaying: false,
        timelineScale: 50
      };

      // Send export request to API
      const response = await fetch('/api/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectData,
          exportSettings
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Export failed');
      }

      const result = await response.json();
      
      // Start tracking the export job with initial status
      const newJob: ExportJob = {
        jobId: result.jobId,
        status: 'waiting',
        progress: 0,
        createdAt: result.createdAt || new Date().toISOString()
      };
      
      setExportJob(newJob);
      startPolling(result.jobId);
      
      // Show success toast
      toast({
        title: "Export Started",
        description: "Your video export has been queued for processing.",
        variant: "default",
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setExportError(errorMessage);
      setExportJob({
        jobId: '',
        status: 'failed',
        progress: 0,
        createdAt: new Date().toISOString(),
        failedReason: errorMessage
      });
      
      // Show error toast with retry option
      toast({
        title: "Export Failed",
        description: errorMessage,
        variant: "destructive",
        action: retryCount < 3 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={retryExport}
            disabled={isExporting}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry ({retryCount + 1}/3)
          </Button>
        ) : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const startPolling = (jobId: string) => {
    // Clear any existing polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/render/status/${jobId}`);
        
        if (!response.ok) {
          throw new Error('Failed to get job status');
        }

        const result = await response.json();
        const jobData = result.job;
        
        setExportJob(prev => prev ? {
          ...prev,
          status: jobData.status,
          progress: jobData.progress || 0,
          processedAt: jobData.processedAt,
          finishedAt: jobData.finishedAt,
          downloadUrl: jobData.downloadUrl,
          failedReason: jobData.failedReason,
          data: jobData.data
        } : null);

        // Stop polling if job is completed or failed
        if (jobData.status === 'completed' || jobData.status === 'failed') {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Show completion/failure toast
          if (jobData.status === 'completed') {
            toast({
              title: "Export Complete",
              description: "Your video has been exported successfully!",
              variant: "success",
            });
          } else if (jobData.status === 'failed') {
            toast({
              title: "Export Failed",
              description: jobData.failedReason || "Export failed due to an unknown error.",
              variant: "destructive",
            });
          }
        }
        
      } catch (error) {
        console.error('Failed to poll job status:', error);
        setExportJob(prev => prev ? {
          ...prev,
          status: 'failed',
          failedReason: 'Failed to get export status'
        } : null);
        
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 2000); // Poll every 2 seconds
  };

  const handleDownload = () => {
    if (exportJob?.downloadUrl) {
      const link = document.createElement('a');
      link.href = exportJob.downloadUrl;
      link.download = `${projectState.projectSettings.name}.${exportSettings.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClose = () => {
    // Clean up polling interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    // Reset state when closing
    setExportJob(null);
    setIsExporting(false);
    onOpenChange(false);
  };

  const getStatusIcon = () => {
    if (!exportJob) return null;
    
    switch (exportJob.status) {
      case 'waiting':
      case 'delayed':
        return <Clock className="h-4 w-4 text-yellow-500 animate-pulse" />;
      case 'active':
        return <Film className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500 animate-pulse" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'paused':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeVariant = () => {
    if (!exportJob) return 'secondary';
    
    switch (exportJob.status) {
      case 'waiting':
      case 'delayed':
        return 'secondary';
      case 'active':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'paused':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getProgressText = () => {
    if (!exportJob) return '';
    
    switch (exportJob.status) {
      case 'waiting':
        return 'Waiting in queue...';
      case 'delayed':
        return 'Export delayed, retrying...';
      case 'active':
        return `Processing video... ${Math.round(exportJob.progress)}%`;
      case 'completed':
        return 'Export completed successfully!';
      case 'failed':
        return `Export failed: ${exportJob.failedReason || 'Unknown error'}`;
      case 'paused':
        return 'Export paused';
      default:
        return 'Processing...';
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              Export Video
            </DialogTitle>
            <DialogDescription>
              Configure your export settings and render your video project.
            </DialogDescription>
          </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Export Settings */}
          {!exportJob && (
            <div className="space-y-4">
              {/* Basic Settings */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="resolution" className="text-right">
                  Resolution
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select
                      value={exportSettings.resolution}
                      onValueChange={(value: '720p' | '1080p' | '4K') => 
                        setExportSettings(prev => ({ ...prev, resolution: value }))
                      }
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select resolution" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="720p">
                          <div className="flex items-center gap-2">
                            720p (1280x720)
                            <Badge variant="outline" className="text-xs">Fast</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="1080p">
                          <div className="flex items-center gap-2">
                            1080p (1920x1080)
                            <Badge variant="outline" className="text-xs">Recommended</Badge>
                          </div>
                        </SelectItem>
                        <SelectItem value="4K">
                          <div className="flex items-center gap-2">
                            4K (3840x2160)
                            <Badge variant="outline" className="text-xs">High Quality</Badge>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Higher resolutions provide better quality but take longer to export</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="format" className="text-right">
                  Format
                </Label>
                <Select
                  value={exportSettings.format}
                  onValueChange={(value: 'mp4' | 'mov' | 'webm') => 
                    setExportSettings(prev => ({ ...prev, format: value }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mp4">MP4</SelectItem>
                    <SelectItem value="mov">MOV</SelectItem>
                    <SelectItem value="webm">WebM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="quality" className="text-right">
                  Quality
                </Label>
                <Select
                  value={exportSettings.quality}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'ultra') => 
                    setExportSettings(prev => ({ ...prev, quality: value }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select quality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (Fast)</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="ultra">Ultra (Slow)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fps" className="text-right">
                  Frame Rate
                </Label>
                <Select
                  value={exportSettings.fps.toString()}
                  onValueChange={(value: string) => 
                    setExportSettings(prev => ({ ...prev, fps: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select frame rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24">24 fps (Cinema)</SelectItem>
                    <SelectItem value="25">25 fps (PAL)</SelectItem>
                    <SelectItem value="30">30 fps (Standard)</SelectItem>
                    <SelectItem value="60">60 fps (Smooth)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Advanced Settings Toggle */}
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-sm"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                </Button>
              </div>

              {/* Advanced Settings */}
              {showAdvanced && (
                <>
                  <div className="border-t border-gray-200 my-4" />
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="videoCodec" className="text-right">
                        Video Codec
                      </Label>
                      <Select
                        value={exportSettings.videoCodec}
                        onValueChange={(value: 'h264' | 'h265' | 'vp9') => 
                          setExportSettings(prev => ({ ...prev, videoCodec: value }))
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select video codec" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="h264">H.264 (Compatible)</SelectItem>
                          <SelectItem value="h265">H.265 (Efficient)</SelectItem>
                          <SelectItem value="vp9">VP9 (WebM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="audioCodec" className="text-right">
                        Audio Codec
                      </Label>
                      <Select
                        value={exportSettings.audioCodec}
                        onValueChange={(value: 'aac' | 'mp3' | 'opus') => 
                          setExportSettings(prev => ({ ...prev, audioCodec: value }))
                        }
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="Select audio codec" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aac">AAC (Recommended)</SelectItem>
                          <SelectItem value="mp3">MP3</SelectItem>
                          <SelectItem value="opus">Opus (WebM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="videoBitrate" className="text-right">
                        Video Bitrate
                      </Label>
                      <Input
                        id="videoBitrate"
                        placeholder="e.g., 5000k, 10M"
                        value={exportSettings.videoBitrate || ''}
                        onChange={(e) => 
                          setExportSettings(prev => ({ 
                            ...prev, 
                            videoBitrate: e.target.value || undefined 
                          }))
                        }
                        className="col-span-3"
                      />
                    </div>

                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="audioBitrate" className="text-right">
                        Audio Bitrate
                      </Label>
                      <Input
                        id="audioBitrate"
                        placeholder="e.g., 128k, 320k"
                        value={exportSettings.audioBitrate || ''}
                        onChange={(e) => 
                          setExportSettings(prev => ({ 
                            ...prev, 
                            audioBitrate: e.target.value || undefined 
                          }))
                        }
                        className="col-span-3"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Please fix the following issues:</div>
                      <ul className="list-disc list-inside space-y-1">
                        {validationErrors.map((error, index) => (
                          <li key={index} className="text-sm">{error}</li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Export Progress */}
          {exportJob && (
            <div className="space-y-4">
              {/* Job Status Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusIcon()}
                  <Badge variant={getStatusBadgeVariant()}>
                    {exportJob.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  ID: {exportJob.jobId.slice(-8)}
                </div>
              </div>

              {/* Progress Text */}
              <div className="text-center">
                <p className="text-sm font-medium">{getProgressText()}</p>
              </div>
              
              {/* Progress Bar for Active Jobs */}
              {exportJob.status === 'active' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Progress value={exportJob.progress || 0} className="w-full h-3" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white drop-shadow-sm">
                        {Math.round(exportJob.progress)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <LoadingSpinner size="sm" />
                      <span>Processing video...</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      <span>ETA: ~{Math.max(1, Math.round((100 - exportJob.progress) / 10))}min</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Waiting state animation */}
              {(exportJob.status === 'waiting' || exportJob.status === 'delayed') && (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="lg" text="Waiting in queue..." />
                </div>
              )}

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium">Created:</span>
                  <br />
                  {formatTimestamp(exportJob.createdAt)}
                </div>
                {exportJob.processedAt && (
                  <div>
                    <span className="font-medium">Started:</span>
                    <br />
                    {formatTimestamp(exportJob.processedAt)}
                  </div>
                )}
                {exportJob.finishedAt && (
                  <div className="col-span-2">
                    <span className="font-medium">Finished:</span>
                    <br />
                    {formatTimestamp(exportJob.finishedAt)}
                  </div>
                )}
              </div>
              
              {/* Success State with Download */}
              {exportJob.status === 'completed' && exportJob.downloadUrl && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your video has been exported successfully and is ready for download.
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Error State */}
              {exportJob.status === 'failed' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {exportJob.failedReason || 'Export failed due to an unknown error.'}
                  </AlertDescription>
                </Alert>
              )}

              {/* Download Button */}
              {exportJob.status === 'completed' && exportJob.downloadUrl && (
                <Button onClick={handleDownload} className="w-full" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download Video
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!exportJob ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleExport} 
                    disabled={isExporting || validationErrors.length > 0}
                    className="flex items-center gap-2"
                  >
                    {isExporting ? (
                      <>
                        <LoadingSpinner size="sm" />
                        Starting Export...
                      </>
                    ) : (
                      <>
                        <Film className="h-4 w-4" />
                        Start Export
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {validationErrors.length > 0 
                      ? "Fix validation errors to enable export" 
                      : "Begin rendering your video with the selected settings"
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </>
          ) : (
            <div className="flex gap-2">
              {exportJob.status === 'completed' && exportJob.downloadUrl && (
                <Button onClick={handleDownload} className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Download Video
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>
                {exportJob.status === 'active' ? 'Close (Export Continues)' : 'Close'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
}