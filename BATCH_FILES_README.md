# Aether Editor - Batch File Guide

This directory contains Windows batch files to easily run the Aether Editor application.

## Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Redis Server** - Required for job queue management
  - Option 1: Docker - `docker run -d -p 6379:6379 redis`
  - Option 2: WSL2 with Redis installation
  - Option 3: Redis for Windows

## Batch Files

### 🚀 `start-aether.bat` - Full Setup & Start
**Use this for first-time setup or after pulling new changes**

- Checks system requirements (Node.js, npm, Redis)
- Installs all dependencies automatically
- Starts both frontend and backend services
- Opens services in separate command windows

### ⚡ `quick-start.bat` - Quick Launch
**Use this for daily development when dependencies are already installed**

- Quickly starts frontend and backend services
- No dependency installation
- Minimal output, fast startup

### 🛠️ `dev-tools.bat` - Development Menu
**Interactive menu for various development tasks**

Features:
- Start individual services (frontend, backend, worker)
- Run tests
- Build applications
- Clean install dependencies
- Test API setup

## Application URLs

Once started, access the application at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## Architecture Overview

**Aether Editor** is a web-based video editor with:

- **Frontend** (`apps/web`): React + Vite + PixiJS + Konva
- **Backend** (`apps/api`): Express + BullMQ + FFmpeg
- **Worker**: Background video processing
- **Types** (`packages/types`): Shared Zod schemas

## Troubleshooting

### Redis Connection Issues
If you see Redis warnings:
1. Install Redis using Docker: `docker run -d -p 6379:6379 redis`
2. Or install Redis locally for your system
3. Ensure Redis is running on `localhost:6379`

### Port Conflicts
- Frontend uses port 3000
- Backend uses port 3001
- Make sure these ports are available

### Dependency Issues
Use `dev-tools.bat` → Option 9 for clean reinstall

## Development Workflow

1. **First time**: Run `start-aether.bat`
2. **Daily use**: Run `quick-start.bat`
3. **Development tasks**: Use `dev-tools.bat`

## Manual Commands

If you prefer manual control:

```bash
# Frontend
cd apps/web
npm run dev

# Backend + Worker
cd apps/api
npm run dev:all

# Individual services
npm run dev        # API only
npm run dev:worker # Worker only
```