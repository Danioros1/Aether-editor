import express from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  createUploadMiddleware,
  handleUploadError,
  validateFile,
  getFileTypeFromMimeType,
  formatFileSize,
  createUploadProgress,
  updateUploadProgress,
  getUploadProgress,
  cleanupUploadProgress,
  UploadError
} from '../middleware/uploadValidation';

const router = express.Router();

// Helper function to get default duration based on asset type
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

// Helper function to create asset data
const createAssetData = (file: Express.Multer.File, baseUrl: string) => {
  const assetType = getFileTypeFromMimeType(file.mimetype);
  const duration = getDefaultDuration(assetType);
  const sourceUrl = `${baseUrl}/uploads/${file.filename}`;

  return {
    assetId: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    fileName: file.originalname,
    type: assetType,
    sourceUrl,
    duration,
    fileSize: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date().toISOString()
  };
};

// Initialize upload middleware
export const initializeUploadRoutes = (uploadsDir: string) => {
  const upload = createUploadMiddleware(uploadsDir);

  // Single file upload with progress tracking
  router.post('/single', (req, res, next) => {
    const uploadId = uuidv4();
    req.body.uploadId = uploadId;

    // Create progress tracking
    if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length']);
      createUploadProgress(uploadId, 'unknown');
    }

    upload.single('file')(req, res, (err) => {
      if (err) {
        updateUploadProgress(uploadId, {
          status: 'failed',
          progress: 0,
          message: 'Upload failed',
          error: err.message
        });
        return handleUploadError(err, req, res, next);
      }

      try {
        if (!req.file) {
          updateUploadProgress(uploadId, {
            status: 'failed',
            progress: 0,
            message: 'No file received',
            error: 'No file uploaded'
          });
          
          return res.status(400).json({
            success: false,
            error: 'NO_FILE',
            message: 'No file uploaded',
            uploadId
          });
        }

        // Update progress to processing
        updateUploadProgress(uploadId, {
          filename: req.file.originalname,
          status: 'processing',
          progress: 90,
          message: 'Processing uploaded file...'
        });

        // Perform additional validation
        const validationErrors = validateFile(req.file);
        if (validationErrors.length > 0) {
          // Clean up uploaded file
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }

          updateUploadProgress(uploadId, {
            status: 'failed',
            progress: 0,
            message: 'File validation failed',
            error: validationErrors[0].message
          });

          return res.status(400).json({
            success: false,
            error: 'VALIDATION_FAILED',
            message: 'File validation failed',
            validationErrors,
            uploadId
          });
        }

        // Create asset data
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const assetData = createAssetData(req.file, baseUrl);

        // Update progress to completed
        updateUploadProgress(uploadId, {
          status: 'completed',
          progress: 100,
          message: 'Upload completed successfully'
        });

        res.status(200).json({
          success: true,
          asset: assetData,
          uploadId,
          message: 'File uploaded successfully'
        });

        // Clean up progress after 5 minutes
        setTimeout(() => {
          cleanupUploadProgress(uploadId);
        }, 5 * 60 * 1000);

      } catch (error) {
        console.error('Upload processing error:', error);
        
        updateUploadProgress(uploadId, {
          status: 'failed',
          progress: 0,
          message: 'Processing failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
          success: false,
          error: 'PROCESSING_FAILED',
          message: 'Failed to process uploaded file',
          uploadId,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  });

  // Multiple file upload with progress tracking
  router.post('/multiple', (req, res, next) => {
    const uploadId = uuidv4();
    req.body.uploadId = uploadId;

    // Create progress tracking
    createUploadProgress(uploadId, 'multiple files');

    upload.array('files', 10)(req, res, (err) => {
      if (err) {
        updateUploadProgress(uploadId, {
          status: 'failed',
          progress: 0,
          message: 'Upload failed',
          error: err.message
        });
        return handleUploadError(err, req, res, next);
      }

      try {
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
          updateUploadProgress(uploadId, {
            status: 'failed',
            progress: 0,
            message: 'No files received',
            error: 'No files uploaded'
          });

          return res.status(400).json({
            success: false,
            error: 'NO_FILES',
            message: 'No files uploaded',
            uploadId
          });
        }

        // Update progress to processing
        updateUploadProgress(uploadId, {
          status: 'processing',
          progress: 50,
          message: `Processing ${req.files.length} uploaded files...`
        });

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const assets = [];
        const validationErrors = [];
        const processedFiles = [];

        // Process each file
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          
          // Update progress
          const progress = 50 + (i / req.files.length) * 40;
          updateUploadProgress(uploadId, {
            progress,
            message: `Processing file ${i + 1} of ${req.files.length}: ${file.originalname}`
          });

          // Validate file
          const fileValidationErrors = validateFile(file);
          if (fileValidationErrors.length > 0) {
            validationErrors.push({
              filename: file.originalname,
              errors: fileValidationErrors
            });
            
            // Clean up invalid file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
            continue;
          }

          // Create asset data for valid file
          const assetData = createAssetData(file, baseUrl);
          assets.push(assetData);
          processedFiles.push(file.originalname);
        }

        // Update final progress
        updateUploadProgress(uploadId, {
          status: 'completed',
          progress: 100,
          message: `Completed processing ${assets.length} files`
        });

        // Prepare response
        const response: any = {
          success: true,
          assets,
          count: assets.length,
          uploadId,
          message: `Successfully processed ${assets.length} of ${req.files.length} files`
        };

        // Include validation errors if any
        if (validationErrors.length > 0) {
          response.validationErrors = validationErrors;
          response.message += `. ${validationErrors.length} files failed validation.`;
        }

        res.status(200).json(response);

        // Clean up progress after 5 minutes
        setTimeout(() => {
          cleanupUploadProgress(uploadId);
        }, 5 * 60 * 1000);

      } catch (error) {
        console.error('Multiple upload processing error:', error);
        
        updateUploadProgress(uploadId, {
          status: 'failed',
          progress: 0,
          message: 'Processing failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        // Clean up uploaded files
        if (req.files && Array.isArray(req.files)) {
          req.files.forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }

        res.status(500).json({
          success: false,
          error: 'PROCESSING_FAILED',
          message: 'Failed to process uploaded files',
          uploadId,
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });
  });

  // Get upload progress
  router.get('/progress/:uploadId', (req, res) => {
    const { uploadId } = req.params;

    if (!uploadId || typeof uploadId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_UPLOAD_ID',
        message: 'Upload ID must be provided as a string'
      });
    }

    const progress = getUploadProgress(uploadId);

    if (!progress) {
      return res.status(404).json({
        success: false,
        error: 'PROGRESS_NOT_FOUND',
        message: `Upload progress for ID ${uploadId} was not found`
      });
    }

    res.status(200).json({
      success: true,
      progress
    });
  });

  // Validate file endpoint (without uploading)
  router.post('/validate', upload.single('file'), (req, res, next) => {
    // This endpoint uses the same upload middleware but doesn't save the file
    // It's useful for client-side validation before actual upload
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'NO_FILE',
        message: 'No file provided for validation'
      });
    }

    try {
      const validationErrors = validateFile(req.file);
      
      // Clean up the temporary file since we're only validating
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_FAILED',
          message: 'File validation failed',
          validationErrors
        });
      }

      const fileType = getFileTypeFromMimeType(req.file.mimetype);
      
      res.status(200).json({
        success: true,
        message: 'File validation passed',
        fileInfo: {
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          formattedSize: formatFileSize(req.file.size),
          type: fileType
        }
      });

    } catch (error) {
      console.error('File validation error:', error);
      
      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'An error occurred during file validation',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
};

export default router;