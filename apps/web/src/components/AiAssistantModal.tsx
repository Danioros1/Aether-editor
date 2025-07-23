import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Sparkles,
  FileText,
  Download
} from 'lucide-react';
import { useAetherStore, useAetherActions } from '../store/useAetherStore';
import { AetherProjectSchema } from '@aether-editor/types';

interface AiAssistantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiAssistantModal({ open, onOpenChange }: AiAssistantModalProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'import'>('prompt');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // Get current project state and actions
  const projectState = useAetherStore();
  const { loadProject } = useAetherActions();

  // Generate master prompt with current context
  const generateMasterPrompt = () => {
    const assetCount = projectState.assetLibrary.length;
    const assetTypes = [...new Set(projectState.assetLibrary.map(asset => asset.type))];
    const hasClips = projectState.timeline.videoTracks.some(track => track.length > 0) || 
                     projectState.timeline.audioTracks.some(track => track.length > 0);
    
    const assetList = projectState.assetLibrary.map(asset => 
      `- ${asset.fileName} (${asset.type}${asset.duration ? `, ${asset.duration}s` : ''})`
    ).join('\n');

    return `# Aether Editor AI Assistant

You are an AI assistant helping to create video projects for Aether Editor, a professional web-based video editing application.

## Current Project Context

**Project Name:** ${projectState.projectSettings.name}
**Resolution:** ${projectState.projectSettings.resolution}
**FPS:** ${projectState.projectSettings.fps}
**Duration:** ${projectState.projectSettings.duration} seconds

**Available Assets (${assetCount}):**
${assetList || 'No assets currently available'}

**Asset Types Available:** ${assetTypes.join(', ') || 'None'}
**Current Timeline Status:** ${hasClips ? 'Has clips arranged' : 'Empty timeline'}

## Your Task

Create a complete video project configuration in JSON format that follows the Aether Editor schema. The project should be creative, engaging, and make use of available assets or specify placeholder assets that the user can upload.

## Schema Requirements

You must return a valid JSON object that matches this exact schema:

\`\`\`json
{
  "projectSettings": {
    "name": "string",
    "resolution": "1080p" | "4K",
    "fps": number,
    "duration": number
  },
  "assetLibrary": [
    {
      "assetId": "string",
      "fileName": "string", 
      "type": "image" | "video" | "audio",
      "sourceUrl": "string (optional)",
      "thumbnailUrl": "string (optional)",
      "duration": number (optional, required for video/audio)
    }
  ],
  "timeline": {
    "videoTracks": [
      [
        {
          "clipId": "string",
          "assetId": "string",
          "startTime": number,
          "duration": number,
          "volume": number,
          "animation": {
            "type": "ken_burns",
            "startRect": { "x": number, "y": number, "scale": number },
            "endRect": { "x": number, "y": number, "scale": number }
          } (optional),
          "transition": {
            "type": "cross_dissolve",
            "duration": number
          } (optional),
          "textOverlays": [
            {
              "text": "string",
              "startTime": number,
              "duration": number,
              "position": { "x": number, "y": number }
            }
          ]
        }
      ]
    ],
    "audioTracks": [
      [
        {
          "clipId": "string",
          "assetId": "string", 
          "startTime": number,
          "duration": number,
          "volume": number,
          "textOverlays": []
        }
      ]
    ]
  },
  "selectedClipId": null,
  "currentTime": 0,
  "isPlaying": false,
  "timelineScale": 50
}
\`\`\`

## Guidelines

1. **Use Existing Assets:** Prioritize using assets that are already available in the project
2. **Placeholder Assets:** If you need additional assets, create placeholder entries with descriptive filenames like "hero-shot.mp4" or "background-music.mp3"
3. **Realistic Timing:** Ensure clip durations and start times make sense for the overall project duration
4. **Creative Effects:** Use Ken Burns animations for images and transitions between clips where appropriate
5. **Text Overlays:** Add engaging text overlays with proper timing and positioning
6. **Audio Sync:** Ensure audio tracks complement video content
7. **Professional Quality:** Create a project that demonstrates professional video editing capabilities

## Response Format

Respond with ONLY the JSON object - no additional text, explanations, or markdown formatting. The JSON must be valid and parseable.`;
  };

  // Copy prompt to clipboard
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generateMasterPrompt());
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (error) {
      console.error('Failed to copy prompt:', error);
    }
  };

  // Handle JSON import
  const handleImportJson = () => {
    setImportError(null);
    setImportSuccess(false);

    try {
      // Parse JSON
      const parsedJson = JSON.parse(jsonInput);
      
      // Validate against schema
      const validationResult = AetherProjectSchema.safeParse(parsedJson);
      
      if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join('\n');
        setImportError(`Schema validation failed:\n${errorMessages}`);
        return;
      }

      const projectData = validationResult.data;
      
      // Process assets to identify placeholders
      const processedAssets = projectData.assetLibrary.map(asset => {
        // If asset has no sourceUrl or thumbnailUrl, treat it as placeholder
        const isPlaceholder = !asset.sourceUrl && !asset.thumbnailUrl;
        
        if (isPlaceholder) {
          return {
            ...asset,
            isPlaceholder: true,
            placeholderDescription: asset.fileName.includes('.') 
              ? `Upload ${asset.type} file: ${asset.fileName}`
              : `Upload ${asset.type} for: ${asset.fileName}`
          };
        }
        
        return {
          ...asset,
          isPlaceholder: false
        };
      });

      // Update project with processed assets
      const processedProject = {
        ...projectData,
        assetLibrary: processedAssets
      };

      // Load the processed project
      loadProject(processedProject);
      
      // Check if there are placeholder assets
      const placeholderCount = processedAssets.filter(asset => asset.isPlaceholder).length;
      
      if (placeholderCount > 0) {
        setImportSuccess(true);
        // Show success message with placeholder info
        setTimeout(() => {
          setJsonInput('');
          setImportSuccess(false);
          onOpenChange(false);
        }, 3000); // Give more time to read the message
      } else {
        setImportSuccess(true);
        // Standard success flow
        setTimeout(() => {
          setJsonInput('');
          setImportSuccess(false);
          onOpenChange(false);
        }, 2000);
      }
      
    } catch (error) {
      if (error instanceof SyntaxError) {
        setImportError('Invalid JSON format. Please check your JSON syntax.');
      } else {
        setImportError(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Handle file upload for JSON import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);
    };
    reader.readAsText(file);
  };

  // Export current project as JSON
  const handleExportProject = () => {
    const projectData = {
      projectSettings: projectState.projectSettings,
      assetLibrary: projectState.assetLibrary,
      timeline: projectState.timeline,
      selectedClipId: null,
      currentTime: 0,
      isPlaying: false,
      timelineScale: 50
    };

    const jsonString = JSON.stringify(projectData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectState.projectSettings.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Assistant
          </DialogTitle>
          <DialogDescription>
            Generate AI prompts for video creation or import AI-generated project configurations.
          </DialogDescription>
        </DialogHeader>
        
        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          <Button
            variant={activeTab === 'prompt' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('prompt')}
            className="flex-1"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Prompt
          </Button>
          <Button
            variant={activeTab === 'import' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setActiveTab('import')}
            className="flex-1"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Project
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Generate Prompt Tab */}
          {activeTab === 'prompt' && (
            <div className="space-y-4 py-4">
              {/* Project Context Summary */}
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Current Project Context</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Project Name</Label>
                    <p className="font-medium">{projectState.projectSettings.name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Resolution</Label>
                    <p className="font-medium">{projectState.projectSettings.resolution}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Duration</Label>
                    <p className="font-medium">{projectState.projectSettings.duration}s</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Assets</Label>
                    <p className="font-medium">{projectState.assetLibrary.length} files</p>
                  </div>
                </div>
                
                {projectState.assetLibrary.length > 0 && (
                  <div className="mt-3">
                    <Label className="text-muted-foreground">Available Assets</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {projectState.assetLibrary.map(asset => (
                        <Badge key={asset.assetId} variant="outline" className="text-xs">
                          {asset.fileName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Generated Prompt */}
              <div className="space-y-2">
                <Label>AI Prompt (Copy this to your AI assistant)</Label>
                <div className="relative">
                  <textarea
                    value={generateMasterPrompt()}
                    readOnly
                    className="w-full h-64 p-3 text-sm font-mono bg-muted border rounded-md resize-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={handleCopyPrompt}
                  >
                    {copiedPrompt ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  Copy this prompt to your preferred AI assistant (ChatGPT, Claude, etc.) to generate a complete video project configuration. The AI will create a JSON response that you can import back into Aether Editor.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Import Project Tab */}
          {activeTab === 'import' && (
            <div className="space-y-4 py-4">
              {/* File Upload Option */}
              <div className="space-y-2">
                <Label>Upload JSON File</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="json-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('json-upload')?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    or paste JSON below
                  </span>
                </div>
              </div>

              {/* JSON Input */}
              <div className="space-y-2">
                <Label>AI-Generated Project JSON</Label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder="Paste the JSON response from your AI assistant here..."
                  className="w-full h-48 p-3 text-sm font-mono border rounded-md resize-none"
                />
              </div>

              {/* Import Status */}
              {importError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="whitespace-pre-line">
                    {importError}
                  </AlertDescription>
                </Alert>
              )}

              {importSuccess && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {(() => {
                      const placeholderCount = projectState.assetLibrary.filter(asset => asset.isPlaceholder).length;
                      if (placeholderCount > 0) {
                        return `Project imported successfully! Found ${placeholderCount} placeholder asset${placeholderCount > 1 ? 's' : ''} that need${placeholderCount === 1 ? 's' : ''} to be uploaded. Check the Asset Library for orange placeholder cards and click them to upload files.`;
                      }
                      return 'Project imported successfully! The modal will close automatically.';
                    })()}
                  </AlertDescription>
                </Alert>
              )}

              {/* Import Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleImportJson}
                  disabled={!jsonInput.trim() || importSuccess}
                  className="flex-1"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Import Project
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setJsonInput('')}
                  disabled={!jsonInput.trim()}
                >
                  Clear
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Importing a project will replace your current project. Make sure to export your current work if you want to keep it.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleExportProject}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Current Project
          </Button>
          <Button onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}