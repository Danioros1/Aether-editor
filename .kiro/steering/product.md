# Product Overview

Aether Editor is a web-based, Canva-like video editor designed for professional video creation with two primary workflows:

1. **Manual Editing**: Full-featured multi-track video editor with timeline, preview, asset library, and property inspector
2. **AI-Assisted Creation**: LLM-powered project generation from text descriptions

## Core Features

- Professional four-panel interface (timeline, preview, asset library, property inspector)
- Real-time video preview with synchronized audio
- Drag-and-drop timeline editing with snapping and precision controls
- Ken Burns animations and cross-dissolve transitions
- Asset management with thumbnail generation
- Video export with customizable quality settings
- Comprehensive undo/redo system
- Auto-save project persistence

## Target Users

- Video editors seeking a web-based alternative to desktop tools
- Content creators wanting AI-assisted video generation
- Professionals needing browser-based collaborative editing

## Technical Approach

The application emphasizes performance through strategic technology choices:
- PixiJS for high-performance preview rendering
- Konva.js for interactive timeline manipulation
- FFmpeg for professional video processing
- Type-safe architecture with comprehensive Zod schemas