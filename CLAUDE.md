# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

Jaaz is an open-source AI design agent desktop application built with Electron, React, and Python FastAPI. It consists of three main components:

### Frontend (React)
- **Location**: `react/` directory
- **Stack**: React 19, TypeScript, Vite, TailwindCSS, Radix UI
- **Key Features**: 
  - Canvas-based design interface using Excalidraw and tldraw
  - Real-time chat interface with AI agents
  - Multi-provider AI model integration (OpenAI, Claude, Ollama, etc.)
  - Internationalization (i18n) support
  - Theme switching (dark/light mode)

### Backend (Python FastAPI)
- **Location**: `server/` directory  
- **Stack**: FastAPI, SQLite (aiosqlite), WebSocket, LangGraph
- **Key Features**:
  - RESTful API endpoints for chat, canvas, settings
  - WebSocket support for real-time communication
  - AI agent orchestration using LangGraph
  - ComfyUI integration for image generation
  - Database migrations and configuration management

### Desktop App (Electron)
- **Location**: `electron/` directory
- **Features**: Cross-platform desktop wrapper, auto-updater, system integration

## Development Commands

### Full Development Setup
```bash
# Install dependencies for all components
npm install                    # Root Electron dependencies
cd react && npm install       # Frontend dependencies

# Backend dependencies (use existing venv)
cd ../server
source venv/bin/activate       # Activate existing virtual environment
pip install -r requirements.txt  # Backend dependencies

# Start development servers
npm run dev                    # Starts both React and Electron in development mode
# OR separately:
npm run dev:react             # Start React dev server (port 5174)
npm run dev:electron          # Start Electron app in development mode
```

### Frontend Development (React)
```bash
cd react
npm run dev                   # Start Vite dev server
npm run build                 # Build for production
npm run lint                  # Run ESLint
npm run preview               # Preview production build
```

### Backend Development (Python)
```bash
cd server
# IMPORTANT: Always activate the existing virtual environment first
source venv/bin/activate      # Activate existing virtual environment
python main.py                # Start FastAPI server (port 57988)
# The server automatically serves the React build at runtime

# If venv doesn't exist, create it once:
# python3 -m venv venv
# source venv/bin/activate
# pip install -r requirements.txt
```

### Testing
```bash
# Run Electron tests (Vitest)
npm test                      # Interactive mode
npm run test:run              # Run once
npm run test:watch           # Watch mode

# Frontend linting
cd react && npm run lint
```

### Building for Production
```bash
# Build complete application
npm start                     # Build React + start Electron

# Platform-specific builds
npm run build:win            # Windows
npm run build:mac            # macOS  
npm run build:linux          # Linux
```

## Key Configuration Files

- `package.json`: Root Electron configuration and build scripts
- `react/package.json`: Frontend dependencies and scripts
- `react/vite.config.ts`: Vite configuration with proxy setup
- `server/requirements.txt`: Python dependencies
- `server/main.py`: FastAPI application entry point
- `vitest.config.js`: Test configuration for Electron components

## Development Workflow

1. **API Development**: Backend runs on port 57988, frontend proxies `/api` and `/ws` requests during development
2. **Real-time Features**: WebSocket connections handle chat, canvas updates, and AI agent communication
3. **AI Integration**: Multiple providers supported through unified API layer
4. **Canvas System**: Supports both Excalidraw and tldraw for different use cases
5. **Database**: SQLite with migration system in `server/services/migrations/`

## Important Notes

- The React dev server runs on port 5174 and proxies to the Python backend
- WebSocket connections are used extensively for real-time features
- The application supports both local AI models (via Ollama) and cloud APIs
- ComfyUI integration requires separate installation for advanced image generation
- Internationalization files are in `react/src/i18n/locales/`