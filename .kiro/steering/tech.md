# Technology Stack

## Build System
- **Monorepo**: Turborepo for efficient build orchestration
- **Package Manager**: npm with workspaces
- **TypeScript**: Strict mode enabled across all packages

## Frontend (apps/web)
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with React plugin
- **State Management**: Zustand with temporal middleware (zundo)
- **Styling**: Tailwind CSS with shadcn/ui components
- **Rendering**: 
  - PixiJS for high-performance preview window
  - Konva.js (react-konva) for interactive timeline
- **Media Processing**: FFmpeg.wasm for client-side operations
- **Testing**: Vitest with jsdom, React Testing Library

## Backend (apps/api)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with CORS and Helmet
- **Job Queue**: BullMQ with Redis
- **Video Processing**: FFmpeg with fluent-ffmpeg wrapper
- **File Handling**: Multer for uploads, local file storage

## Shared Packages
- **Types**: Zod schemas for runtime validation
- **Monorepo Structure**: `@aether-editor/` scoped packages

## Common Commands

### Development
```bash
# Start web dev server
cd apps/web && npm run dev

# Start API server
cd apps/api && npm run dev

# Start both API and worker
cd apps/api && npm run dev:all

# Watch mode for types package
cd packages/types && npm run dev
```

### Building
```bash
# Build web app
cd apps/web && npm run build

# Build API
cd apps/api && npm run build

# Build types
cd packages/types && npm run build
```

### Testing
```bash
# Run web tests
cd apps/web && npm run test

# Test API worker setup
cd apps/api && npm run test:setup
```

## Key Dependencies
- **Frontend**: React, Zustand, PixiJS, Konva, FFmpeg.wasm, Tailwind
- **Backend**: Express, BullMQ, FFmpeg, Redis
- **Shared**: Zod for schemas, TypeScript for type safety