# Folder Structure

This document provides a comprehensive overview of the Jaaz codebase organization and folder structure.

## Overview

Jaaz follows a **three-tier architecture** with clear separation between desktop wrapper, frontend UI, and backend services:

```
jaaz/
├── electron/              # Desktop application layer
├── react/                 # Frontend user interface
├── server/                # Backend API server
├── assets/                # Static resources
├── scripts/               # Build and deployment scripts
├── docs/                  # Documentation (this folder)
├── node_modules/          # Root dependencies
├── package.json           # Main application configuration
├── package-lock.json      # Dependency lock file
├── vitest.config.js       # Test configuration
├── entitlements.mac.plist # macOS security entitlements
├── CLAUDE.md              # AI assistant guidance
├── LICENSE                # License file
└── README.md              # Project documentation
```

## Electron Layer (`/electron/`)

**Purpose**: Native desktop functionality and system integration

```
electron/
├── main.js                # Main Electron process
├── preload.js             # Secure IPC bridge
├── ipcHandlers.js         # Inter-process communication handlers
├── settingsService.js     # Application settings management
├── comfyUIManager.js      # ComfyUI integration manager
├── comfyUIInstaller.js    # ComfyUI installation handler
└── test/                  # Electron component tests
    └── comfyUIInstaller/  # ComfyUI installer tests
        ├── core-functions.test.js
        ├── download-functions.test.js
        └── process-management.test.js
```

### Key Files Explained
- **`main.js`**: Entry point for Electron app, handles window creation, app lifecycle
- **`preload.js`**: Security bridge that exposes safe APIs to renderer process
- **`ipcHandlers.js`**: Handles communication between main and renderer processes
- **`settingsService.js`**: Manages user preferences and configuration
- **`comfyUIManager.js`**: Manages ComfyUI workflows and execution
- **`comfyUIInstaller.js`**: Handles ComfyUI installation and updates

## React Layer (`/react/`)

**Purpose**: Modern React-based user interface with TypeScript

```
react/
├── src/
│   ├── components/         # Feature-based React components
│   ├── api/               # Backend API clients
│   ├── contexts/          # React context providers
│   ├── hooks/             # Custom React hooks
│   ├── i18n/              # Internationalization
│   ├── routes/            # Application routing
│   ├── stores/            # State management
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── assets/            # Styles and static assets
│   ├── examples/          # Example data and configurations
│   ├── lib/               # Library utilities
│   ├── constants.ts       # Application constants
│   ├── main.tsx           # React application entry point
│   ├── route-tree.gen.ts  # Generated route tree
│   └── vite-env.d.ts      # Vite environment types
├── public/                # Static public assets
├── node_modules/          # Frontend dependencies
├── package.json           # Frontend dependencies and scripts
├── package-lock.json      # Frontend dependency lock
├── tsconfig.json          # TypeScript configuration
├── tsconfig.app.json      # App-specific TypeScript config
├── tsconfig.node.json     # Node-specific TypeScript config
├── vite.config.ts         # Vite build configuration
├── eslint.config.js       # ESLint configuration
├── components.json        # UI component configuration
├── index.html             # HTML template
└── README.md              # Frontend documentation
```

### Components Structure (`/react/src/components/`)

Feature-based organization with clear separation of concerns:

```
components/
├── agent_studio/          # AI agent workflow management
│   ├── AgentNode.tsx      # Individual agent node component
│   ├── AgentSettings.tsx  # Agent configuration interface
│   └── AgentStudio.tsx    # Main agent studio interface
├── auth/                  # Authentication components
│   ├── LoginDialog.tsx    # Login modal dialog
│   └── UserMenu.tsx       # User account menu
├── canvas/                # Drawing and design canvas
│   ├── CanvasExcali.tsx   # Excalidraw integration
│   ├── CanvasExport.tsx   # Canvas export functionality
│   ├── CanvasHeader.tsx   # Canvas toolbar header
│   ├── menu/              # Canvas menu components
│   └── pop-bar/           # Canvas popup toolbar
├── chat/                  # AI chat interface
│   ├── Chat.tsx           # Main chat component
│   ├── ChatHistory.tsx    # Chat history management
│   ├── ChatTextarea.tsx   # Chat input component
│   ├── Message/           # Message components
│   ├── ModelSelector.tsx  # AI model selection
│   └── [other chat components]
├── comfyui/               # ComfyUI integration dialogs
├── common/                # Shared utility components
├── home/                  # Home screen and project management
├── knowledge/             # Knowledge base interface
├── settings/              # Application settings UI
├── sidebar/               # Navigation and file management
├── theme/                 # Theme switching functionality
└── ui/                    # Reusable UI components (shadcn/ui)
```

### API Layer (`/react/src/api/`)

```
api/
├── auth.ts               # Authentication API calls
├── billing.ts            # Billing and subscription API
├── canvas.ts             # Canvas operations API
├── chat.ts               # Chat functionality API
├── config.ts             # Configuration API
├── model.ts              # AI model management API
├── settings.ts           # Settings API
└── upload.ts             # File upload API
```

### State Management (`/react/src/stores/`)

```
stores/
├── canvas.ts             # Canvas state management (Zustand)
└── configs.ts            # Configuration state management
```

### Internationalization (`/react/src/i18n/`)

```
i18n/
├── index.ts              # i18n configuration
├── locales/
│   ├── en/               # English translations
│   │   ├── canvas.json   # Canvas-related translations
│   │   ├── chat.json     # Chat-related translations
│   │   ├── common.json   # Common UI translations
│   │   ├── home.json     # Home screen translations
│   │   └── settings.json # Settings translations
│   └── zh-CN/            # Chinese translations
│       ├── canvas.json
│       ├── chat.json
│       ├── common.json
│       ├── home.json
│       └── settings.json
└── README.md             # i18n documentation
```

## Server Layer (`/server/`)

**Purpose**: Python FastAPI backend with AI orchestration

```
server/
├── routers/              # API route handlers
├── services/             # Business logic layer
├── tools/                # AI tools and generators
├── models/               # Data models
├── utils/                # Utility functions
├── asset/                # Server assets (workflows, configs)
├── main.py               # FastAPI application entry point
├── main.spec             # PyInstaller specification
├── common.py             # Common utilities
└── requirements.txt      # Python dependencies
```

### API Routes (`/server/routers/`)

```
routers/
├── __init__.py           # Router package initialization
├── agent.py              # AI agent management endpoints
├── canvas.py             # Canvas operation endpoints
├── chat_router.py        # Chat functionality endpoints
├── comfyui_execution.py  # ComfyUI workflow execution
├── config.py             # Configuration management endpoints
├── image_tools.py        # Image processing endpoints
├── settings.py           # Settings management endpoints
├── ssl_test.py           # SSL testing utilities
├── video_generators.py   # Video generation endpoints
├── video_tools.py        # Video processing endpoints
├── websocket_router.py   # WebSocket communication
└── workspace.py          # Workspace management endpoints
```

### Services Layer (`/server/services/`)

```
services/
├── __init__.py           # Services package initialization
├── chat_service.py       # Chat processing service
├── config_service.py     # Configuration management service
├── db_service.py         # Database operations service
├── files_service.py      # File management service
├── langgraph_service.py  # LangGraph AI orchestration
├── mcp.py                # Model Context Protocol service
├── settings_service.py   # Settings management service
├── stream_service.py     # Streaming service
├── utils_service.py      # Utility services
├── websocket_service.py  # WebSocket management service
├── websocket_state.py    # WebSocket state management
└── migrations/           # Database migrations
    ├── __init__.py
    ├── manager.py        # Migration manager
    ├── v1_initial_schema.py    # Initial database schema
    ├── v2_add_canvases.py      # Canvas table addition
    └── v3_add_comfy_workflow.py # ComfyUI workflow table
```

### AI Tools (`/server/tools/`)

```
tools/
├── image_generators.py   # Image generation orchestration
├── img_generators/       # Specific image generator implementations
│   ├── __init__.py
│   ├── base.py           # Base image generator class
│   ├── comfyui.py        # ComfyUI generator
│   ├── jaaz.py           # Jaaz native generator
│   ├── openai.py         # OpenAI DALL-E generator
│   ├── replicate.py      # Replicate API generator
│   ├── volces.py         # Volces generator
│   └── wavespeed.py      # Wavespeed generator
└── write_plan.py         # Planning tool for AI agents
```

### Data Models (`/server/models/`)

```
models/
├── __init__.py           # Models package initialization
└── config_model.py       # Configuration data models
```

## Static Resources (`/assets/`)

```
assets/
├── icons/                # Application icons
│   ├── jaaz.icns         # macOS icon
│   ├── jaaz.ico          # Windows icon
│   ├── jaaz.png          # PNG icon
│   ├── unicorn.icns      # Alternative macOS icon
│   ├── unicorn.ico       # Alternative Windows icon
│   └── unicorn.png       # Alternative PNG icon
└── [screenshot files]    # Documentation screenshots
```

## Build and Scripts (`/scripts/`)

```
scripts/
└── notarize.js           # macOS app notarization script
```

## Organizational Patterns

### 1. **Feature-Based Grouping**
Components and services are organized by feature/domain rather than technical type:
- Chat functionality: `chat/` components, `chat_router.py`, `chat_service.py`
- Canvas functionality: `canvas/` components, `canvas.py` router
- Settings: `settings/` components, `settings.py` router, `settings_service.py`

### 2. **Layer Separation**
Clear boundaries between presentation, business logic, and data layers:
- **Presentation**: React components in `react/src/components/`
- **API Layer**: Route handlers in `server/routers/`
- **Business Logic**: Services in `server/services/`
- **Data Layer**: Models and database operations

### 3. **Technology Boundaries**
Each major technology stack has its own directory with appropriate tooling:
- **Electron**: Node.js modules, IPC handlers, native integrations
- **React**: Modern React with TypeScript, component-based architecture
- **Python**: FastAPI with modern Python async patterns

### 4. **Configuration Management**
Configuration files are appropriately placed:
- **Build configs**: Root level (`package.json`, `vite.config.ts`)
- **Runtime configs**: Per-layer (`react/package.json`, `server/requirements.txt`)
- **Tool configs**: Root level (`eslint.config.js`, `vitest.config.js`)

This structure provides clear separation of concerns, enables independent development of each layer, and maintains scalability as the application grows.