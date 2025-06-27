# Architecture Overview

## System Architecture

Jaaz follows a **three-tier client-server architecture** designed for local deployment with AI integration:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron      │    │     React       │    │  Python FastAPI │
│  Desktop App    │◄──►│   Frontend UI   │◄──►│  Backend Server │
│                 │    │                 │    │                 │
│ • Window Mgmt   │    │ • Components    │    │ • API Routes    │
│ • System Integration │ • State Mgmt    │    │ • AI Services   │
│ • IPC Handlers  │    │ • WebSocket     │    │ • Database      │
│ • Auto Updates  │    │ • Routing       │    │ • Migrations    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  AI Providers   │
                    │                 │
                    │ • Local Models  │
                    │   - Ollama      │
                    │   - ComfyUI     │
                    │ • Cloud APIs    │
                    │   - OpenAI      │
                    │   - Claude      │
                    │   - Replicate   │
                    └─────────────────┘
```

## Component Responsibilities

### Electron Layer (Desktop Application)
**Purpose**: Native desktop functionality and system integration

**Key Responsibilities**:
- Application lifecycle management
- Window creation and management
- System tray integration
- Auto-updater functionality
- IPC (Inter-Process Communication) bridge
- File system access and security
- ComfyUI process management

**Technologies**: Node.js, Electron APIs, native modules

### React Layer (Frontend UI)
**Purpose**: Modern, responsive user interface with real-time capabilities

**Key Responsibilities**:
- Component-based UI architecture
- State management (Zustand)
- Real-time WebSocket communication
- Routing and navigation (TanStack Router)
- Internationalization (i18n)
- Theme management
- Canvas rendering (Excalidraw, tldraw)
- Chat interface with AI

**Technologies**: React 19, TypeScript, Vite, TailwindCSS, Radix UI

### Python Layer (Backend Server)
**Purpose**: API server with AI orchestration and data management

**Key Responsibilities**:
- RESTful API endpoints
- WebSocket server for real-time features
- AI agent orchestration (LangGraph)
- Database operations (SQLite)
- Image processing and generation
- Multi-provider AI integration
- Configuration management
- File upload and storage

**Technologies**: FastAPI, SQLite, LangGraph, WebSocket, Pillow

## Data Flow Architecture

### Request Flow
1. **User Interaction** → React components
2. **API Calls** → Python FastAPI endpoints
3. **AI Processing** → LangGraph agents → AI providers
4. **Response** → WebSocket/HTTP → React state update → UI render

### Real-time Communication
```
React WebSocket Client ◄─────► Python WebSocket Server
                │                        │
                │                        ▼
                │               ┌─────────────────┐
                │               │  AI Agents      │
                │               │  (LangGraph)    │
                │               └─────────────────┘
                │                        │
                │                        ▼
                │               ┌─────────────────┐
                │               │  AI Providers   │
                │               │  (OpenAI, etc.) │
                └──────────────► └─────────────────┘
```

## Design Principles

### 1. **Local-First Architecture**
- All data stored locally (SQLite database)
- Can operate offline for local AI models
- Cloud APIs used only when explicitly configured

### 2. **Modular AI Integration**
- Provider-agnostic AI service layer
- Easy to add new AI providers
- Fallback mechanisms for provider failures

### 3. **Feature-Based Organization**
- Components grouped by feature, not technology
- Clear separation of concerns
- Independent development of features

### 4. **Real-time Collaboration**
- WebSocket-based real-time updates
- Optimistic UI updates
- State synchronization across components

### 5. **Security by Design**
- Electron security best practices
- API key encryption and storage
- Sandboxed renderer processes

## Inter-Component Communication

### Electron ↔ React
- **Method**: IPC (Inter-Process Communication)
- **Usage**: File operations, system integration, settings
- **Security**: Preload script as secure bridge

### React ↔ Python
- **Method**: HTTP/WebSocket
- **Port**: 57988 (configurable)
- **Proxy**: Vite dev proxy for development
- **Authentication**: Session-based

### Python ↔ AI Providers
- **Method**: HTTP APIs, local processes
- **Patterns**: Async/await, connection pooling
- **Error Handling**: Retry logic, fallback providers

## Scalability Considerations

### Frontend Scalability
- Code splitting with Vite
- Lazy loading of components
- Virtual scrolling for large lists
- Optimized re-renders with React patterns

### Backend Scalability
- Async FastAPI for concurrent requests
- Connection pooling for AI providers
- Background task processing
- Efficient WebSocket management

### Data Management
- SQLite for simplicity and performance
- Migration system for schema changes
- Efficient querying with proper indexing
- File-based configuration management

## Development Architecture

### Hot Reload Support
- Vite HMR for React development
- FastAPI auto-reload for Python changes
- Electron auto-restart on main process changes

### Build Process
1. **React Build** → Static assets
2. **Python Packaging** → Executable server
3. **Electron Packaging** → Desktop application
4. **Cross-platform Distribution** → Platform-specific installers

### Testing Strategy
- **Unit Tests**: Vitest for Electron components
- **Frontend Testing**: React Testing Library patterns
- **Backend Testing**: FastAPI test client
- **Integration Testing**: End-to-end workflows

This architecture enables Jaaz to function as a powerful, locally-deployed AI design tool while maintaining the flexibility to integrate with various AI providers and scale with user needs.