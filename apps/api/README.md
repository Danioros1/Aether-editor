# Aether Editor API

Backend API for the Aether Editor video editing application with FFmpeg rendering worker.

## Features

- File upload and asset management
- Video rendering with FFmpeg
- Job queue management with BullMQ
- Ken Burns animation support
- Multi-clip composition and transitions
- Progress tracking for render jobs

## Prerequisites

- Node.js 18+ 
- Redis server (for job queue)
- FFmpeg (automatically installed via @ffmpeg-installer/ffmpeg)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install and start Redis server:
   - **Windows**: Download from https://redis.io/download or use WSL
   - **macOS**: `brew install redis && brew services start redis`
   - **Linux**: `sudo apt-get install redis-server && sudo systemctl start redis`

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
```
PORT=3001
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Development

### Start API Server Only
```bash
npm run dev
```

### Start Worker Only
```bash
npm run dev:worker
```

### Start Both API and Worker
```bash
npm run dev:all
```

### Test Setup
```bash
node test-worker.js
```

## Production

1. Build the application:
```bash
npm run build
```

2. Start API server:
```bash
npm start
```

3. Start worker (in separate process):
```bash
npm run start:worker
```

## API Endpoints

### File Upload
- `POST /api/upload` - Upload single file
- `POST /api/upload/multiple` - Upload multiple files

### Video Rendering
- `POST /api/render` - Create render job
- `GET /api/render/status/:jobId` - Get job status

### Static Files
- `GET /uploads/:filename` - Serve uploaded assets
- `GET /downloads/:filename` - Serve rendered videos

## Render Job Flow

1. Client uploads assets via `/api/upload`
2. Client creates project with timeline data
3. Client submits render job via `/api/render`
4. API validates project and queues job with BullMQ
5. Worker processes job with FFmpeg:
   - Renders individual clips with effects
   - Combines clips into final video
   - Applies transitions and audio mixing
6. Client polls `/api/render/status/:jobId` for progress
7. Client downloads completed video from provided URL

## Worker Architecture

The FFmpeg worker processes render jobs in stages:

1. **Validation**: Verify project data and assets
2. **Clip Processing**: Render individual clips with:
   - Ken Burns animations (zoompan filter)
   - Volume adjustments
   - Duration trimming
3. **Combination**: Concatenate clips using FFmpeg filter complex
4. **Transitions**: Apply cross-dissolve effects (basic implementation)
5. **Finalization**: Output final MP4 with specified resolution

## Error Handling

- Comprehensive error logging
- Job retry with exponential backoff
- Graceful shutdown handling
- Asset validation and missing file detection
- FFmpeg process monitoring and timeout handling

## Monitoring

- Job queue status via BullMQ
- Progress updates during rendering
- Detailed logging for debugging
- Health check endpoint at `/health`