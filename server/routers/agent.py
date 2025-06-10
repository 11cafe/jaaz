import asyncio
import base64
import subprocess
import json
import os
from pathlib import Path
import traceback
from typing import Optional
from fastapi import APIRouter, Request, WebSocket, Query, HTTPException
from fastapi.responses import FileResponse
import asyncio

from utils.http_client import HttpClient
from services.agent_service import openai_client, anthropic_client, ollama_client
from services.mcp import MCPClient
from services.config_service import config_service, app_config, USER_DATA_DIR
from starlette.websockets import WebSocketDisconnect
from services.db_service import db_service
from routers.image_tools import generate_image, generate_image_tool
from routers.websocket import active_websockets, send_to_websocket
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent
from langgraph.prebuilt.chat_agent_executor import AgentState
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

llm_config = config_service.get_config()

wsrouter = APIRouter()
stream_tasks = {}


@wsrouter.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, session_id: str = Query(...)):
    await websocket.accept()
    active_websockets[session_id] = websocket
    try:
        # Keep the connection alive
        while True:
            # Wait for messages (optional, if you need to receive from client)
            data = await websocket.receive_text()
            # Process the message if needed
    except WebSocketDisconnect as e:
        print(f"WebSocket disconnected: {e.code}, {e.reason}")
    except Exception as e:
        print(f"WebSocket error: {e}")
        traceback.print_exc()
    finally:
        if session_id in active_websockets:
            del active_websockets[session_id]


def detect_image_type_from_base64(b64_data: str) -> str:
    # Only take the base64 part, not the "data:image/...," prefix
    if b64_data.startswith("data:"):
        b64_data = b64_data.split(",", 1)[1]

    # Decode just the first few bytes
    prefix_bytes = base64.b64decode(b64_data[:24])  # ~18 bytes is enough

    if prefix_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    elif prefix_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    elif prefix_bytes.startswith(b"GIF87a") or prefix_bytes.startswith(b"GIF89a"):
        return "image/gif"
    elif prefix_bytes.startswith(b"RIFF") and b"WEBP" in prefix_bytes:
        return "image/webp"
    else:
        return "application/octet-stream"


router = APIRouter(prefix="/api")


@router.post("/chat")
async def chat(request: Request):
    data = await request.json()
    messages = data.get('messages')
    session_id = data.get('session_id')
    canvas_id = data.get('canvas_id')
    text_model = data.get('text_model')
    image_model = data.get('image_model')
    print('👇app_config.get("system_prompt", "")',
          app_config.get('system_prompt', ''))
    if app_config.get('system_prompt', ''):
        messages.append({
            'role': 'system',
            'content': app_config.get('system_prompt', '')
        })

    if len(messages) == 1:
        # create new session
        prompt = messages[0].get('content', '')
        # TODO: Better way to determin when to create new chat session.
        await db_service.create_chat_session(session_id, text_model.get('model'), text_model.get('provider'), canvas_id, (prompt[:200] if isinstance(prompt, str) else ''))

    await db_service.create_message(session_id, messages[-1].get('role', 'user'), json.dumps(messages[-1])) if len(messages) > 0 else None

    task = asyncio.create_task(langraph_agent(
        messages, session_id, text_model, image_model))
    stream_tasks[session_id] = task
    try:
        await task
    except asyncio.exceptions.CancelledError:
        print(f"🛑Session {session_id} cancelled during stream")
    finally:
        stream_tasks.pop(session_id, None)
        await send_to_websocket(session_id, {
            'type': 'done'
        })

    return {"status": "done"}


async def langraph_agent(messages, session_id, text_model, image_model):
    model = text_model.get('model')
    provider = text_model.get('provider')
    url = text_model.get('url')
    api_key = app_config.get(provider, {}).get("api_key", "")
    print('👇model', model, provider, url, api_key)
    # TODO: Verify if max token is working
    max_tokens = text_model.get('max_tokens', 8148)
    if provider == 'ollama':
        model = ChatOllama(
            model=model,
            base_url=url,
        )
    else:
        # Create both sync and async httpx clients for ChatOpenAI
        http_async_client = HttpClient.create_async_client(
            url=url, timeout=1000)
        http_sync_client = HttpClient.create_sync_client(url=url, timeout=1000)
        model = ChatOpenAI(
            model=model,
            api_key=api_key,
            timeout=1000,
            base_url=url,
            temperature=0,
            max_tokens=max_tokens,
            http_client=http_sync_client,
            http_async_client=http_async_client
        )
    agent = create_react_agent(
        model=model,
        tools=[generate_image_tool],
        prompt='You are a profession design agent, specializing in visual design.'
    )
    ctx = {
        'session_id': session_id,
        'model_info': {
            'image': image_model
        },
    }
    tool_calls: list[ToolCall] = []
    async for chunk in agent.astream(
        {"messages": messages},
        config=ctx,
        stream_mode=["updates", "messages", "custom"]
    ):
        chunk_type = chunk[0]

        if chunk_type == 'updates':
            all_messages = chunk[1].get(
                'agent', chunk[1].get('tools')).get('messages', [])
            oai_messages = convert_to_openai_messages(all_messages)
            # new_message = oai_messages[-1]

            messages.extend(oai_messages)
            await send_to_websocket(session_id, {
                'type': 'all_messages',
                'messages': messages
            })
            for new_message in oai_messages:
                await db_service.create_message(session_id, new_message.get('role', 'user'), json.dumps(new_message)) if len(messages) > 0 else None
        else:
            # Access the AIMessageChunk
            ai_message_chunk: AIMessageChunk = chunk[1][0]
            print('👇ai_message_chunk', ai_message_chunk)
            content = ai_message_chunk.content  # Get the content from the AIMessageChunk
            if isinstance(ai_message_chunk, ToolMessage):
                print('👇tool_call_results', ai_message_chunk.content)
            elif content:
                await send_to_websocket(session_id, {
                    'type': 'delta',
                    'text': content
                })
            elif hasattr(ai_message_chunk, 'tool_calls') and ai_message_chunk.tool_calls and ai_message_chunk.tool_calls[0].get('name'):
                for index, tool_call in enumerate(ai_message_chunk.tool_calls):
                    if tool_call.get('name'):
                        tool_calls.append(tool_call)
                        print('😘tool_call', tool_call, tool_call.get(
                            'name'), tool_call.get('id'))
                        await send_to_websocket(session_id, {
                            'type': 'tool_call',
                            'id': tool_call.get('id'),
                            'name': tool_call.get('name'),
                            'arguments': '{}'
                        })
            elif hasattr(ai_message_chunk, 'tool_call_chunks'):
                tool_call_chunks = ai_message_chunk.tool_call_chunks
                for tool_call_chunk in tool_call_chunks:
                    index: int = tool_call_chunk['index']
                    if index < len(tool_calls):
                        for_tool_call: ToolCall = tool_calls[index]
                        print('🦄sending tool_call_arguments', 'id',
                              for_tool_call, 'text', tool_call_chunk.get('args'))
                        await send_to_websocket(session_id, {
                            'type': 'tool_call_arguments',
                            'id': for_tool_call.get('id'),
                            'text': tool_call_chunk.get('args')
                        })
            else:
                print('👇no tool_call_chunks', chunk)


@router.post("/cancel/{session_id}")
async def cancel_chat(session_id: str):
    task = stream_tasks.get(session_id)
    if task and not task.done():
        task.cancel()
        return {"status": "cancelled"}
    return {"status": "not_found_or_done"}

# @router.get("/workspace_list")
# async def workspace_list():
#     return [{"name": entry.name, "is_dir": entry.is_dir(), "path": str(entry)} for entry in Path(WORKSPACE_ROOT).iterdir()]


@router.get("/workspace_download")
async def workspace_download(path: str):
    file_path = Path(path)
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    return {"error": "File not found"}


def get_ollama_model_list():
    base_url = config_service.get_config().get('ollama', {}).get(
        'url', os.getenv('OLLAMA_HOST', 'http://localhost:11434'))
    try:
        with HttpClient.create_sync(base_url) as client:
            response = client.get(f'{base_url}/api/tags', timeout=5)
            response.raise_for_status()
            data = response.json()
            return [model['name'] for model in data.get('models', [])]
    except Exception as e:
        print(f"Error querying Ollama: {e}")
        return []


@router.get("/list_models")
async def get_models():
    config = config_service.get_config()
    res = []
    ollama_models = get_ollama_model_list()
    ollama_url = config_service.get_config().get('ollama', {}).get(
        'url', os.getenv('OLLAMA_HOST', 'http://localhost:11434'))
    print('👇ollama_models', ollama_models)
    for ollama_model in ollama_models:
        res.append({
            'provider': 'ollama',
            'model': ollama_model,
            'url': ollama_url,
            'type': 'text'
        })
    for provider in config.keys():
        models = config[provider].get('models', {})
        for model_name in models:
            if provider == 'ollama':
                continue
            if provider != 'comfyui' and config[provider].get('api_key', '') == '':
                continue
            model = models[model_name]
            res.append({
                'provider': provider,
                'model': model_name,
                'url': config[provider].get('url', ''),
                'type': model.get('type', 'text')
            })
    return res

mcp_clients: dict[str, MCPClient] = {}
mcp_clients_status = {}
mcp_tool_to_server_mapping: dict[str, MCPClient] = {}


async def initialize():
    # await initialize_mcp()
    for session_id in active_websockets:
        await send_to_websocket(session_id, {
            'type': 'init_done'
        })


async def initialize_mcp():
    print('👇initializing mcp')
    mcp_config_path = os.path.join(USER_DATA_DIR, "mcp.json")
    if not os.path.exists(mcp_config_path):
        return {}
    with open(mcp_config_path, "r") as f:
        json_data = json.load(f)
    global mcp_clients
    global mcp_clients_status
    global mcp_tool_to_server_mapping
    mcp_clients_json: dict[str, dict] = json_data.get('mcpServers', {})

    for server_name, server in list(mcp_clients_json.items()):
        if server.get('command') is None:
            continue
        if server.get('args') is None:
            server['args'] = []

        mcp_client = MCPClient()
        mcp_clients_status[server_name] = {
            'status': 'initializing'
        }
        try:
            await mcp_client.connect_to_server(server["command"], server["args"], server.get('env'))
            mcp_clients_status[server_name] = {
                'status': 'connected',
                'tools': mcp_client.tools
            }
            print('👇mcp_client connected', server_name,
                  'tools', len(mcp_client.tools))
            for tool in mcp_client.tools:
                mcp_tool_to_server_mapping[tool['name']] = mcp_client
                print('tool', tool)
                openai_client.tools.append({
                    'type': 'function',
                    'function': {
                        'name': tool['name'],
                        'description': tool['description'],
                        'parameters': tool['input_schema']
                    }
                })
                anthropic_client.tools.append(tool)
                ollama_client.tools.append({
                    'type': 'function',
                    'function': {
                        'name': tool['name'],
                        'description': tool['description'],
                        'parameters': tool['input_schema']
                    }
                })

            mcp_clients[server_name] = mcp_client
        except Exception as e:
            print(f"Error connecting to MCP server {server_name}: {e}")
            traceback.print_exc()
            mcp_clients_status[server_name] = {
                'status': 'error',
                'error': str(e)
            }


@router.get("/list_mcp_servers")
async def list_mcp_servers():
    if mcp_clients is None:
        return {}
    mcp_config_path = os.path.join(USER_DATA_DIR, "mcp.json")
    if not os.path.exists(mcp_config_path):
        return {}
    with open(mcp_config_path, "r") as f:
        json_data = json.load(f)
    mcp_servers = json_data.get('mcpServers', {})
    for server_name, server in mcp_servers.items():
        mcp_servers[server_name]['tools'] = mcp_clients_status[server_name].get(
            'tools', [])
        mcp_servers[server_name]['status'] = mcp_clients_status[server_name].get(
            'status', 'error')
    return mcp_servers


@router.get("/list_chat_sessions")
async def list_chat_sessions():
    return await db_service.list_sessions()


@router.get("/chat_session/{session_id}")
async def get_chat_session(session_id: str):
    return await db_service.get_chat_history(session_id)
