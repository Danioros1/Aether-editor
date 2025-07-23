import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// File type validation
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'],
  video: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm', 'video/mkv'],
  audio: ['audio/mp3', 'audio/wav', 'audio/aac', 'audio/ogg', 'audio/flac', 'audio/m4a']
};

const ALL_ALLOWED_TYPES = [
  ...ALLOWED_MIME_TYPES.image,
  ...ALLOWED_MIME_TYPES.video,
  ...ALLOWED_MIME_TYPES.audio
];

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 50 * 1024 * 1024,  // 50MB for images
  video: 500 * 1024 * 1024, // 500MB for videos
  audio: 100 * 1024 * 1024  // 100MB for audio
};

// File name validation
const INVALID_FILENAME_CHARS = /[<>:"/\\|?*\x00-\x1f]/;
const MAX_FILENAME_LENGTH = 255;

export interface UploadValidationError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export class UploadError extends Error {
  public code: string;
  public statusCode: number;
  public details?: any;

  constructor(code: string, message: string, statusCode: number = 400, details?: any) {
    super(message);
    this.name = 'UploadError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// Comprehensive file validation
export const validateFile = (file: Express.Multer.File): UploadValidationError[] => {
  const errors: UploadValidationError[] = [];

  // Check if file exists
  if (!file) {
    errors.push({
      code: 'NO_FILE',
      message: 'No file was uploaded'
    });
    return errors;
  }

  // Validate MIME type
  if (!ALL_ALLOWED_TYPES.includes(file.mimetype)) {
    errors.push({
      code: 'INVALID_FILE_TYPE',
      message: `File type '${file.mimetype}' is not supported. Allowed types: images, videos, and audio files.`,
      details: {
        receivedType: file.mimetype,
        allowedTypes: ALL_ALLOWED_TYPES
      }
    });
  }

  // Validate file size based on type
  const fileType = getFileTypeFromMimeType(file.mimetype);
  const sizeLimit = FILE_SIZE_LIMITS[fileType];
  
  if (file.size > sizeLimit) {
    errors.push({
      code: 'FILE_TOO_LARGE',
      message: `File size (${formatFileSize(file.size)}) exceeds the limit for ${fileType} files (${formatFileSize(sizeLimit)})`,
      details: {
        fileSize: file.size,
        sizeLimit,
        fileType
      }
    });
  }

  // Validate filename
  if (!file.originalname || file.originalname.trim().length === 0) {
    errors.push({
      code: 'INVALID_FILENAME',
      message: 'File must have a valid name'
    });
  } else {
    if (file.originalname.length > MAX_FILENAME_LENGTH) {
      errors.push({
        code: 'FILENAME_TOO_LONG',
        message: `Filename is too long (${file.originalname.length} characters). Maximum allowed: ${MAX_FILENAME_LENGTH} characters.`,
        details: {
          filenameLength: file.originalname.length,
          maxLength: MAX_FILENAME_LENGTH
        }
      });
    }

    if (INVALID_FILENAME_CHARS.test(file.originalname)) {
      errors.push({
        code: 'INVALID_FILENAME_CHARS',
        message: 'Filename contains invalid characters. Please remove special characters like < > : " / \\ | ? *',
        details: {
          filename: file.originalname
        }
      });
    }
  }

  // Validate file extension matches MIME type
  const extension = path.extname(file.originalname).toLowerCase();
  if (!isValidExtensionForMimeType(extension, file.mimetype)) {
    errors.push({
      code: 'EXTENSION_MISMATCH',
      message: `File extension '${extension}' does not match the detected file type '${file.mimetype}'`,
      details: {
        extension,
        mimeType: file.mimetype
      }
    });
  }

  return errors;
};

// Helper functions
export const getFileTypeFromMimeType = (mimeType: string): 'image' | 'video' | 'audio' => {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return 'video';
  if (ALLOWED_MIME_TYPES.audio.includes(mimeType)) return 'audio';
  return 'image'; // Default fallback
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isValidExtensionForMimeType = (extension: string, mimeType: string): boolean => {
  const extensionMap: { [key: string]: string[] } = {
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.bmp': ['image/bmp'],
    '.mp4': ['video/mp4'],
    '.avi': ['video/avi'],
    '.mov': ['video/mov'],
    '.wmv': ['video/wmv'],
    '.flv': ['video/flv'],
    '.webm': ['video/webm'],
    '.mkv': ['video/mkv'],
    '.mp3': ['audio/mp3', 'audio/mpeg'],
    '.wav': ['audio/wav'],
    '.aac': ['audio/aac'],
    '.ogg': ['audio/ogg'],
    '.flac': ['audio/flac'],
    '.m4a': ['audio/m4a']
  };

  const validMimeTypes = extensionMap[extension];
  return validMimeTypes ? validMimeTypes.includes(mimeType) : false;
};

// Enhanced multer configuration with better error handling
export const createUploadMiddleware = (uploadsDir: string) => {
  // Ensure uploads directory exists
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      // Check if uploads directory is writable
      try {
        fs.accessSync(uploadsDir, fs.constants.W_OK);
        cb(null, uploadsDir);
      } catch (error) {
        cb(new UploadError(
          'UPLOAD_DIR_NOT_WRITABLE',
          'Upload directory is not writable',
          500,
          { uploadsDir, error: (error as Error).message }
        ), '');
      }
    },
    filename: (req, file, cb) => {
      try {
        // Generate unique filename with original extension
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname);
        const filename = `${uniqueId}${extension}`;
        cb(null, filename);
      } catch (error) {
        cb(new UploadError(
          'FILENAME_GENERATION_ERROR',
          'Failed to generate unique filename',
          500,
          { originalName: file.originalname, error: (error as Error).message }
        ), '');
      }
    }
  });

  return multer({
    storage,
    limits: {
      fileSize: Math.max(...Object.values(FILE_SIZE_LIMITS)), // Use the largest limit
      files: 10, // Maximum 10 files per request
      fieldSize: 1024 * 1024, // 1MB for form fields
    },
    fileFilter: (req, file, cb) => {
      const errors = validateFile(file);
      
      if (errors.length > 0) {
        const primaryError = errors[0];
        cb(new UploadError(
          primaryError.code,
          primaryError.message,
          400,
          { validationErrors: errors }
        ));
      } else {
        cb(null, true);
      }
    }
  });
};

// Middleware to handle upload errors
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Upload error:', error);

  // Handle multer-specific errors
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          success: false,
          error: 'FILE_TOO_LARGE',
          message: 'File size exceeds the maximum allowed limit',
          details: {
            limit: error.message,
            code: error.code
          }
        });
      
      case 'LIMIT_FILE_COUNT':
        return res.status(413).json({
          success: false,
          error: 'TOO_MANY_FILES',
          message: 'Too many files uploaded. Maximum 10 files allowed per request.',
          details: {
            code: error.code
          }
        });
      
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: 'UNEXPECTED_FILE',
          message: 'Unexpected file field. Please use the correct field name.',
          details: {
            field: error.field,
            code: error.code
          }
        });
      
      default:
        return res.status(400).json({
          success: false,
          error: 'UPLOAD_ERROR',
          message: error.message || 'File upload failed',
          details: {
            code: error.code
          }
        });
    }
  }

  // Handle custom upload errors
  if (error instanceof UploadError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.code,
      message: error.message,
      details: error.details
    });
  }

  // Handle other errors
  return res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred during file upload',
    details: {
      message: error.message
    }
  });
};

// Progress tracking utilities
export interface UploadProgress {
  uploadId: string;
  filename: string;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  message: string;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

// In-memory progress tracking (in production, use Redis or database)
const uploadProgress = new Map<string, UploadProgress>();

export const createUploadProgress = (uploadId: string, filename: string): UploadProgress => {
  const progress: UploadProgress = {
    uploadId,
    filename,
    progress: 0,
    status: 'uploading',
    message: 'Starting upload...',
    startTime: new Date()
  };
  
  uploadProgress.set(uploadId, progress);
  return progress;
};

export const updateUploadProgress = (uploadId: string, updates: Partial<UploadProgress>): UploadProgress | null => {
  const existing = uploadProgress.get(uploadId);
  if (!existing) return null;
  
  const updated = { ...existing, ...updates };
  if (updates.status === 'completed' || updates.status === 'failed') {
    updated.endTime = new Date();
  }
  
  uploadProgress.set(uploadId, updated);
  return updated;
};

export const getUploadProgress = (uploadId: string): UploadProgress | null => {
  return uploadProgress.get(uploadId) || null;
};

export const cleanupUploadProgress = (uploadId: string): void => {
  uploadProgress.delete(uploadId);
};

// Auto-cleanup old progress entries (run periodically)
export const cleanupOldProgress = (maxAgeMinutes: number = 60): void => {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  
  for (const [uploadId, progress] of uploadProgress.entries()) {
    if (progress.startTime < cutoff && (progress.status === 'completed' || progress.status === 'failed')) {
      uploadProgress.delete(uploadId);
    }
  }
};