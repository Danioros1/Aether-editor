// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const API_ENDPOINTS = {
  upload: `${API_BASE_URL}/api/upload`,
  uploadMultiple: `${API_BASE_URL}/api/upload/multiple`,
  health: `${API_BASE_URL}/health`,
} as const;