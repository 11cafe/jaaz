# AI Integration

This document explains how Jaaz integrates with various AI providers and orchestrates AI workflows.

## AI Architecture Overview

Jaaz implements a **multi-provider AI architecture** that supports both local and cloud-based AI models:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │  Chat Interface │    │ Model Selector  │               │
│  └─────────────────┘    └─────────────────┘               │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                Backend (Python FastAPI)                    │
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │  LangGraph      │    │  Provider       │               │
│  │  Orchestration  │◄──►│  Management     │               │
│  └─────────────────┘    └─────────────────┘               │
└─────────────────────────┼───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │  Local  │     │  Cloud  │     │  Image  │
    │ Models  │     │   LLMs  │     │   Gen   │
    │         │     │         │     │         │
    │ Ollama  │     │ OpenAI  │     │ComfyUI  │
    │ComfyUI  │     │ Claude  │     │Replicate│
    └─────────┘     └─────────┘     └─────────┘
```

## AI Provider Categories

### 1. Local AI Models

#### Ollama Integration
**Purpose**: Local LLM inference for privacy and offline usage

**Configuration**:
- **Default Port**: 11434
- **Models**: Supports all Ollama-compatible models
- **Installation**: Automatic detection of local Ollama installation

**Implementation**:
```python
# server/services/langgraph_service.py
from langchain_ollama import ChatOllama

def create_ollama_model(model_name: str):
    return ChatOllama(
        model=model_name,
        base_url="http://localhost:11434"
    )
```

#### ComfyUI Integration
**Purpose**: Advanced image generation and editing workflows

**Features**:
- Custom workflow execution
- Node-based image processing
- Local GPU acceleration
- Workflow management

**Key Files**:
- `electron/comfyUIManager.js` - Process management
- `electron/comfyUIInstaller.js` - Installation handling
- `server/routers/comfyui_execution.py` - Workflow execution
- `server/tools/img_generators/comfyui.py` - ComfyUI provider

**Workflow Management**:
```python
# server/routers/comfyui_execution.py
async def execute_comfyui_workflow(workflow_data: dict):
    # Submit workflow to ComfyUI
    # Monitor execution progress
    # Return generated images
```

### 2. Cloud AI Providers

#### OpenAI Integration
**Services**: GPT models, DALL-E image generation

**Configuration**:
```python
# server/tools/img_generators/openai.py
from openai import OpenAI

class OpenAIImageGenerator:
    def __init__(self, api_key: str):
        self.client = OpenAI(api_key=api_key)
    
    async def generate_image(self, prompt: str, **kwargs):
        response = await self.client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="standard"
        )
        return response.data[0].url
```

#### Anthropic Claude Integration
**Services**: Claude models for text generation and analysis

**Implementation**:
```python
# server/services/langgraph_service.py
from anthropic import Anthropic

def create_claude_model(api_key: str, model: str):
    return ChatAnthropic(
        api_key=api_key,
        model=model,
        temperature=0.7
    )
```

#### Replicate Integration
**Services**: Various AI models via Replicate API

**Features**:
- Image generation (Flux, SDXL, etc.)
- Video generation
- Custom model hosting

**Implementation**:
```python
# server/tools/img_generators/replicate.py
import replicate

class ReplicateImageGenerator:
    def __init__(self, api_token: str):
        self.client = replicate.Client(api_token=api_token)
    
    async def generate_image(self, model: str, inputs: dict):
        output = await self.client.run(model, input=inputs)
        return output
```

## LangGraph Orchestration

### Agent Architecture
Jaaz uses **LangGraph** for complex AI workflow orchestration:

```python
# server/services/langgraph_service.py
from langgraph import StateGraph, END

def create_agent_workflow():
    workflow = StateGraph(AgentState)
    
    # Add nodes
    workflow.add_node("chat", chat_node)
    workflow.add_node("image_gen", image_generation_node)
    workflow.add_node("canvas_update", canvas_update_node)
    
    # Add edges
    workflow.add_edge("chat", "image_gen")
    workflow.add_conditional_edges(
        "image_gen",
        should_update_canvas,
        {"yes": "canvas_update", "no": END}
    )
    
    return workflow.compile()
```

### Agent State Management
```python
from typing import TypedDict, List

class AgentState(TypedDict):
    messages: List[BaseMessage]
    current_canvas: Optional[dict]
    generated_images: List[str]
    user_intent: str
    workflow_step: str
```

### Multi-Agent Workflows
**Use Cases**:
- **Design Agent**: Handles visual design tasks
- **Writing Agent**: Manages text content generation
- **Planning Agent**: Coordinates complex multi-step tasks

## Provider Management System

### Provider Configuration
```typescript
// react/src/api/model.ts
interface AIProvider {
  id: string;
  name: string;
  type: 'local' | 'cloud';
  models: string[];
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}
```

### Dynamic Provider Loading
```python
# server/services/config_service.py
class ProviderManager:
    def __init__(self):
        self.providers = {}
    
    def register_provider(self, provider_id: str, provider_class):
        self.providers[provider_id] = provider_class
    
    def get_provider(self, provider_id: str, config: dict):
        if provider_id not in self.providers:
            raise ValueError(f"Unknown provider: {provider_id}")
        return self.providers[provider_id](**config)
```

### Fallback Mechanisms
```python
async def generate_with_fallback(prompt: str, providers: List[str]):
    for provider_id in providers:
        try:
            provider = get_provider(provider_id)
            return await provider.generate(prompt)
        except Exception as e:
            logger.warning(f"Provider {provider_id} failed: {e}")
            continue
    raise Exception("All providers failed")
```

## Image Generation Pipeline

### Multi-Provider Image Generation
```python
# server/tools/image_generators.py
class ImageGenerationOrchestrator:
    def __init__(self):
        self.providers = {
            'openai': OpenAIImageGenerator,
            'replicate': ReplicateImageGenerator,
            'comfyui': ComfyUIImageGenerator,
            'jaaz': JaazImageGenerator,
        }
    
    async def generate_image(self, provider: str, prompt: str, **kwargs):
        generator = self.providers[provider](**kwargs)
        return await generator.generate_image(prompt, **kwargs)
```

### Image Processing Pipeline
1. **Prompt Enhancement**: AI-powered prompt optimization
2. **Provider Selection**: Based on user preference and availability
3. **Generation**: Image creation via selected provider
4. **Post-Processing**: Upscaling, filtering, format conversion
5. **Canvas Integration**: Automatic placement on design canvas

## Real-Time AI Communication

### WebSocket AI Streaming
```python
# server/routers/websocket_router.py
@sio.on('ai_chat')
async def handle_ai_chat(sid, data):
    async for chunk in stream_ai_response(data['message']):
        await sio.emit('ai_response_chunk', {
            'chunk': chunk,
            'message_id': data['message_id']
        }, room=sid)
```

### Frontend Streaming Integration
```typescript
// react/src/components/chat/Chat.tsx
useEffect(() => {
  socket.on('ai_response_chunk', (data) => {
    setMessages(prev => prev.map(msg => 
      msg.id === data.message_id 
        ? { ...msg, content: msg.content + data.chunk }
        : msg
    ));
  });
}, []);
```

## Model Context Protocol (MCP)

### MCP Integration
```python
# server/services/mcp.py
from mcp import MCPClient

class MCPService:
    def __init__(self):
        self.clients = {}
    
    async def register_mcp_server(self, name: str, transport_config: dict):
        client = MCPClient(transport_config)
        await client.connect()
        self.clients[name] = client
    
    async def call_mcp_tool(self, server: str, tool: str, arguments: dict):
        client = self.clients[server]
        return await client.call_tool(tool, arguments)
```

## AI Configuration Management

### Settings Structure
```python
# server/models/config_model.py
class AIConfig:
    providers: Dict[str, ProviderConfig]
    default_chat_model: str
    default_image_model: str
    max_tokens: int
    temperature: float
    stream_responses: bool
```

### Frontend Configuration UI
```typescript
// react/src/components/settings/AddProviderDialog.tsx
const providerTypes = [
  { id: 'openai', name: 'OpenAI', fields: ['apiKey'] },
  { id: 'anthropic', name: 'Claude', fields: ['apiKey'] },
  { id: 'ollama', name: 'Ollama', fields: ['baseUrl'] },
  { id: 'replicate', name: 'Replicate', fields: ['apiToken'] },
];
```

## Performance Optimization

### Caching Strategies
```python
# server/services/chat_service.py
from functools import lru_cache

@lru_cache(maxsize=100)
async def get_model_response(prompt: str, model: str, temperature: float):
    # Cache responses for identical inputs
    pass
```

### Async Processing
```python
import asyncio

async def parallel_image_generation(prompts: List[str]):
    tasks = [generate_image(prompt) for prompt in prompts]
    return await asyncio.gather(*tasks)
```

### Connection Pooling
```python
# server/utils/http_client.py
import aiohttp

class AIProviderClient:
    def __init__(self):
        self.session = aiohttp.ClientSession(
            connector=aiohttp.TCPConnector(limit=10),
            timeout=aiohttp.ClientTimeout(total=30)
        )
```

## Error Handling and Monitoring

### Provider Health Checks
```python
async def check_provider_health(provider_id: str):
    try:
        provider = get_provider(provider_id)
        await provider.health_check()
        return {'status': 'healthy', 'provider': provider_id}
    except Exception as e:
        return {'status': 'unhealthy', 'provider': provider_id, 'error': str(e)}
```

### Rate Limiting
```python
from aiohttp_ratelimiter import RateLimiter

rate_limiter = RateLimiter(
    max_requests=60,
    time_window=60,  # 60 requests per minute
)

@rate_limiter
async def make_ai_request(provider: str, data: dict):
    # Rate-limited AI request
    pass
```

### Usage Tracking
```python
# server/services/utils_service.py
class UsageTracker:
    def __init__(self):
        self.usage_stats = {}
    
    def track_request(self, provider: str, model: str, tokens: int):
        key = f"{provider}:{model}"
        if key not in self.usage_stats:
            self.usage_stats[key] = {'requests': 0, 'tokens': 0}
        self.usage_stats[key]['requests'] += 1
        self.usage_stats[key]['tokens'] += tokens
```

## Best Practices

### 1. **Provider Abstraction**
- Use common interfaces for all AI providers
- Implement graceful fallbacks
- Handle provider-specific errors consistently

### 2. **Security**
- Store API keys securely (encrypted)
- Validate all inputs before sending to AI providers
- Implement request timeouts and limits

### 3. **Performance**
- Cache responses when appropriate
- Use async/await for concurrent requests
- Implement connection pooling

### 4. **User Experience**
- Provide streaming responses for real-time feedback
- Show generation progress and status
- Handle errors gracefully with user-friendly messages

### 5. **Cost Management**
- Track usage and costs per provider
- Implement rate limiting
- Provide usage analytics to users

This AI integration architecture enables Jaaz to leverage the best of both local and cloud AI while providing a seamless user experience for AI-powered design workflows.