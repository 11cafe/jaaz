# Development Guide

This guide covers setup, development workflow, and best practices for working with the Jaaz codebase.

## Prerequisites

### Required Software
- **Node.js** (v18 or higher) - For Electron and React development
- **Python** (v3.8 or higher) - For FastAPI backend
- **Git** - For version control
- **Code Editor** - VS Code recommended with extensions

### Recommended VS Code Extensions
- **TypeScript and JavaScript** - Built-in TypeScript support
- **Python** - Python development support
- **Pylance** - Advanced Python language server
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **Auto Rename Tag** - HTML/JSX tag renaming
- **Thunder Client** - API testing (alternative to Postman)

## Initial Setup

### 1. Clone and Install Dependencies

```bash
# Clone repository
git clone https://github.com/11cafe/jaaz.git
cd jaaz

# Install root dependencies (Electron)
npm install

# Install React dependencies
cd react
npm install --force  # --force flag handles dependency conflicts
cd ..

# Install Python dependencies
cd server
pip install -r requirements.txt
cd ..
```

### 2. Development Environment Configuration

#### Python Virtual Environment (Recommended)
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
cd server
pip install -r requirements.txt
```

#### Environment Variables
Create a `.env` file in the server directory for local configuration:
```env
# API Keys (optional for development)
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
REPLICATE_API_TOKEN=your_token_here

# Server Configuration
PORT=57988
DEBUG=true
```

## Development Workflow

### Option 1: Full Development Mode
Start all services simultaneously:
```bash
npm run dev
```
This command:
- Starts React dev server on port 5174
- Starts Electron app in development mode
- Proxies API requests to Python backend (port 57988)

### Option 2: Individual Component Development

#### Frontend Only (React)
```bash
cd react
npm run dev
```
- Runs on `http://localhost:5174`
- Hot module replacement (HMR) enabled
- Proxies `/api` and `/ws` to backend

#### Backend Only (Python)
```bash
cd server
python main.py
```
- Runs on `http://localhost:57988`
- Auto-reload on code changes
- Serves React build for production

#### Desktop App Only (Electron)
```bash
npm run dev:electron
```
- Starts Electron app
- Loads React from dev server or built files

## Development Server Configuration

### Port Configuration
- **React Dev Server**: 5174 (configurable in `react/vite.config.ts`)
- **Python Backend**: 57988 (configurable in `server/main.py`)
- **Electron**: Uses React dev server in development mode

### Proxy Setup
The React dev server proxies requests to the Python backend:
```typescript
// react/vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:57988',
      changeOrigin: true,
    },
    '/ws': {
      target: 'ws://127.0.0.1:57988',
      ws: true,
    },
  },
}
```

## Testing

### Frontend Testing
```bash
cd react
npm run lint          # ESLint checking
```

### Backend Testing
Currently uses manual testing. Future improvements:
```bash
cd server
# Add test framework (pytest recommended)
pytest tests/
```

### Electron Testing
```bash
npm test              # Run Vitest tests
npm run test:run      # Run tests once
npm run test:watch    # Watch mode
```

## Building for Production

### Development Build
```bash
npm start             # Build React + start Electron
```

### Production Builds
```bash
# Cross-platform builds
npm run build:win     # Windows
npm run build:mac     # macOS
npm run build:linux   # Linux

# All platforms
npm run build:electron
```

### Build Output
- **Electron builds**: `dist/` directory
- **React builds**: `react/dist/` directory
- **Python packaging**: Handled by PyInstaller

## Code Style and Standards

### TypeScript/JavaScript
- **ESLint configuration**: `react/eslint.config.js`
- **TypeScript config**: `react/tsconfig.json`
- **Formatting**: Prettier recommended
- **Naming**: camelCase for variables, PascalCase for components

### Python
- **Style**: Follow PEP 8
- **Type hints**: Use modern Python typing
- **Async/await**: Prefer async patterns for I/O operations
- **Imports**: Organize imports (standard, third-party, local)

### File Organization
- **React Components**: PascalCase filenames (`ChatMessage.tsx`)
- **Python Files**: snake_case filenames (`chat_service.py`)
- **Directories**: kebab-case or snake_case based on context

## Common Development Tasks

### Adding a New React Component
1. Create component file in appropriate feature directory
2. Add to component exports if needed
3. Update routing if it's a page component
4. Add translations if using i18n

### Adding a New API Endpoint
1. Create route handler in `server/routers/`
2. Add business logic to `server/services/`
3. Update API client in `react/src/api/`
4. Add error handling and validation

### Adding a New AI Provider
1. Implement provider in `server/tools/img_generators/`
2. Extend base provider class
3. Add provider configuration
4. Update UI for provider selection

### Database Schema Changes
1. Create migration in `server/services/migrations/`
2. Update models in `server/models/`
3. Test migration locally
4. Update any affected services

## Debugging

### Frontend Debugging
- **React DevTools**: Browser extension for React debugging
- **Browser DevTools**: Network tab for API calls
- **Vite HMR**: Check console for hot reload issues

### Backend Debugging
- **FastAPI Docs**: Available at `http://localhost:57988/docs`
- **Python Debugger**: Use `breakpoint()` or IDE debugging
- **Logging**: Use Python logging module

### Electron Debugging
- **Main Process**: Node.js debugging in VS Code
- **Renderer Process**: Chrome DevTools (Ctrl+Shift+I)
- **IPC Communication**: Log IPC messages for debugging

## Performance Optimization

### Frontend
- **Code Splitting**: Use React.lazy() for large components
- **Bundle Analysis**: Vite bundle analyzer
- **Image Optimization**: Compress images, use appropriate formats
- **State Management**: Optimize Zustand store updates

### Backend
- **Async Operations**: Use async/await for I/O operations
- **Database Queries**: Optimize SQLite queries
- **Caching**: Implement caching for frequently accessed data
- **WebSocket Management**: Efficient connection handling

## Deployment Considerations

### Local Development
- All components run locally
- SQLite database in user data directory
- No external dependencies required

### Production Distribution
- Electron app packages all components
- Python server embedded as executable
- React build served as static files
- Auto-updater for seamless updates

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check if ports are in use
lsof -i :5174  # React dev server
lsof -i :57988 # Python backend

# Kill processes using ports
kill -9 <PID>
```

#### Dependency Issues
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# React dependencies with conflicts
cd react
npm install --force
```

#### Python Environment Issues
```bash
# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Development Tips

1. **Hot Reload**: Both React and Python support hot reload - save files to see changes
2. **Network Tab**: Use browser network tab to debug API calls
3. **WebSocket**: Use browser WebSocket inspector for real-time debugging
4. **Logging**: Add console.log/print statements liberally during development
5. **Git Workflow**: Use feature branches for new development

## Contributing Guidelines

### Code Review Process
1. Create feature branch from main
2. Make changes following coding standards
3. Test thoroughly across all components
4. Submit pull request with clear description
5. Address review feedback

### Commit Message Format
```
type(scope): brief description

- feat: new feature
- fix: bug fix
- docs: documentation changes
- style: formatting, no code change
- refactor: code restructuring
- test: adding tests
- chore: maintenance tasks
```

### Testing Requirements
- Test new features across all three layers
- Verify WebSocket connections work properly
- Test AI provider integrations
- Check cross-platform compatibility

This development guide should help you get productive with the Jaaz codebase quickly. For questions or improvements to this guide, please contribute back to the documentation.