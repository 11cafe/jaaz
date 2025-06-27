"""
langgraph_service.py

本模块封装了 langgraph_agent 异步函数，用于执行 LangGraph + LangChain 构建的 React 风格语言 Agent。
功能包括：
- 初始化对应的语言模型客户端（OpenAI / Ollama 等）
- 创建并运行带工具链的 React Agent
- 处理 Agent 流式返回结果（消息、工具调用、工具调用参数）
- 将更新通过 websocket 推送给前端
- 持久化聊天记录到数据库

依赖模块：
- langgraph, langchain_core, langchain_openai, langchain_ollama
- services.db_service
- services.config_service
- routers.websocket
- routers.image_tools
"""
from pydantic import BaseModel, Field
from tools.write_plan import write_plan_tool
from utils.http_client import HttpClient

import asyncio
import json
import traceback
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langgraph.prebuilt import create_react_agent
from services.db_service import db_service
from services.config_service import config_service
from services.websocket_service import send_to_websocket
from tools.image_generators import generate_image
from tools.video_tools import generate_video
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph_swarm import create_swarm
from langchain_core.tools import BaseTool, InjectedToolCallId, tool
from langchain_core.runnables import RunnableConfig

class InputParam(BaseModel):
    type: str
    description: str
    required: bool
    default: str

def create_tool(tool_json: dict):
    TOOL_MAP = {
        'generate_image': generate_image,
        'generate_video': generate_video,
        'write_plan': write_plan_tool,
    }
    return TOOL_MAP.get(tool_json.get('tool', ''), None)

async def langgraph_agent(messages, canvas_id, session_id, text_model, image_model, video_model=None):
    try:
        model = text_model.get('model')
        provider = text_model.get('provider')
        url = text_model.get('url')
        api_key = config_service.app_config.get(provider, {}).get("api_key", "")
        # TODO: Verify if max token is working
        max_tokens = text_model.get('max_tokens', 8148)
        if provider == 'ollama':
            model = ChatOllama(
                model=model,
                base_url=url,
            )
        else:
            # Create httpx client with SSL configuration for ChatOpenAI
            http_client = HttpClient.create_sync_client(timeout=15)
            http_async_client = HttpClient.create_async_client(timeout=15)
            model = ChatOpenAI(
                model=model,
                api_key=api_key,
                timeout=15,
                base_url=url,
                temperature=0,
                max_tokens=max_tokens,
                http_client=http_client,
                http_async_client=http_async_client
            )
        agent = create_react_agent(
            model=model,
            tools=[generate_image],
            prompt='You are a profession design agent, specializing in visual design.'
        )
        ctx = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            'model_info': {
                'image': image_model,
                'video': video_model
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
                # print('👇ai_message_chunk', ai_message_chunk)
                content = ai_message_chunk.content  # Get the content from the AIMessageChunk
                if isinstance(ai_message_chunk, ToolMessage):
                    print('👇tool_call_results', ai_message_chunk.content)
                elif content:
                    await send_to_websocket(session_id, {
                        'type': 'delta',
                        'text': content
                    })
                elif hasattr(ai_message_chunk, 'tool_calls') and ai_message_chunk.tool_calls and ai_message_chunk.tool_calls[0].get('name'):
                    tool_calls = [tc for tc in ai_message_chunk.tool_calls if tc.get('name')]
                    print('😘tool_call event', ai_message_chunk.tool_calls)
                    for tool_call in tool_calls:
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
                            await send_to_websocket(session_id, {
                                'type': 'tool_call_arguments',
                                'id': for_tool_call.get('id'),
                                'text': tool_call_chunk.get('args')
                            })
                else:
                    print('👇no tool_call_chunks', chunk)

        # 发送完成事件
        await send_to_websocket(session_id, {
            'type': 'done'
        })

    except Exception as e:
        print('Error in langgraph_agent', e)
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })

from langgraph_swarm.handoff import _normalize_agent_name, METADATA_KEY_HANDOFF_DESTINATION
from langchain_core.messages import ToolMessage
from langchain_core.tools import BaseTool, InjectedToolCallId, tool
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import InjectedState, ToolNode
from langgraph.types import Command
from typing import Annotated

def create_handoff_tool(
    *, agent_name: str, name: str | None = None, description: str | None = None
) -> BaseTool:
    """Create a tool that can handoff control to the requested agent.

    Args:
        agent_name: The name of the agent to handoff control to, i.e.
            the name of the agent node in the multi-agent graph.
            Agent names should be simple, clear and unique, preferably in snake_case,
            although you are only limited to the names accepted by LangGraph
            nodes as well as the tool names accepted by LLM providers
            (the tool name will look like this: `transfer_to_<agent_name>`).
        name: Optional name of the tool to use for the handoff.
            If not provided, the tool name will be `transfer_to_<agent_name>`.
        description: Optional description for the handoff tool.
            If not provided, the tool description will be `Ask agent <agent_name> for help`.
    """
    if name is None:
        name = f"transfer_to_{_normalize_agent_name(agent_name)}"

    if description is None:
        description = f"Ask agent '{agent_name}' for help"

    @tool(name, description=description+"""
    \nIMPORTANT RULES:
            1. You MUST complete the other tool calls and wait for their result BEFORE attempting to transfer to another agent
            2. Do NOT call this handoff tool with other tools simultaneously
            3. Always wait for the result of other tool calls before making this handoff call
    """)
    def handoff_to_agent(
        state: Annotated[dict, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
    ):
        tool_message = ToolMessage(
            content=f"<hide_in_user_ui> Successfully transferred to {agent_name}",
            name=name,
            tool_call_id=tool_call_id,
        )
        return Command(
            goto=agent_name,
            graph=Command.PARENT,
            update={"messages": state["messages"] + [tool_message], "active_agent": agent_name},
        )

    handoff_to_agent.metadata = {METADATA_KEY_HANDOFF_DESTINATION: agent_name}
    return handoff_to_agent

async def langgraph_multi_agent(messages, canvas_id, session_id, text_model, image_model, system_prompt: str = None, video_model=None):
    try:
        model = text_model.get('model')
        provider = text_model.get('provider')
        url = text_model.get('url')
        api_key = config_service.app_config.get(provider, {}).get("api_key", "")
        # TODO: Verify if max token is working
        max_tokens = text_model.get('max_tokens', 8148)
        if provider == 'ollama':
            model = ChatOllama(
                model=model,
                base_url=url,
            )
        else:
            # Create httpx client with SSL configuration for ChatOpenAI
            http_client = HttpClient.create_sync_client(timeout=15)
            http_async_client = HttpClient.create_async_client(timeout=15)
            model = ChatOpenAI(
                model=model,
                api_key=api_key,
                timeout=15,
                base_url=url,
                temperature=0,
                max_tokens=max_tokens,
                http_client=http_client,
                http_async_client=http_async_client
            )
        agent_schemas = [
            {
                'name': 'planner',
                'tools': [
                    {
                    'name': 'write_plan',
                    'description': "Write a execution plan for the user's request",
                    'type': 'system',
                    'tool': 'write_plan',
                }
                ],
                'system_prompt': """
            You are a design planning writing agent. You should do:
            - Step 1. write a execution plan for the user's request using the same language as the user's prompt. You should breakdown the task into high level steps for the other agents to execute.
            - Step 2. If it is a image generation task, transfer the task to image_designer agent to generate the image based on the plan IMMEDIATELY, no need to ask for user's approval.

            IMPORTANT RULES:
            1. You MUST complete the write_plan tool call and wait for its result BEFORE attempting to transfer to another agent
            2. Do NOT call multiple tools simultaneously
            3. Always wait for the result of one tool call before making another

            For example, if the user ask to 'Generate a ads video for a lipstick product', the example plan is :
            ```
            [{
                "title": "Design the video script",
                "description": "Design the video script for the ads video"
            }, {
                "title": "Generate the images",
                "description": "Design image prompts, generate the images for the story board"
            }, {
                "title": "Generate the video clips",
                "description": "Generate the video clips from the images"
            }]
            ```
            """,
                'knowledge': [],
                'handoffs': [
                    {
                        'agent_name': 'image_designer',
                        'description': """
                        Transfer user to the image_designer. About this agent: Specialize in generating images.
                        """
                    }
                ]
            },
            {
                'name': 'image_designer',
                'tools': [
                    {
                        'name': 'generate_image',
                        'description': "Generate an image",
                        'tool': 'generate_image',
                    }
                ],
                'system_prompt': system_prompt,
                'knowledge': [],
                'handoffs': [
                    {
                        'agent_name': 'video_designer',
                        'description': """
                        Transfer user to the video_designer. About this agent: Specialize in generating videos from images.
                        """
                    }
                ]
            },
            {
                'name': 'video_designer',
                'tools': [
                    {
                        'name': 'generate_video',
                        'description': "Generate a video from an image and prompt",
                        'tool': 'generate_video',
                    }
                ],
                'system_prompt': """You are a professional video design agent. You specialize in generating videos from images using AI video generation models.
                
When generating videos:
1. Use the generate_video tool with a clear motion prompt describing what should happen in the video
2. Always specify an existing image_id as the starting frame (e.g., 'im_abc123.png')
3. Choose appropriate duration (6s for quick animations, 10s for more complex sequences)
4. Focus on describing motion, camera movement, and animation rather than static descriptions

Example prompts:
- "The woman slowly turns her head to look at the camera, with gentle wind blowing through her hair"
- "Camera slowly zooms out to reveal the full scene, with subtle parallax movement"
- "The product rotates 360 degrees showcasing all angles with professional lighting"
""",
                'knowledge': [],
                'handoffs': []
            }
        ]
        agents = []
        for ag_schema in agent_schemas:
            handoff_tools = []
            for handoff in ag_schema.get('handoffs', []):
                hf = create_handoff_tool(
                    agent_name=handoff['agent_name'],
                    description=handoff['description'],
                )
                if hf:
                    handoff_tools.append(hf)
            tools = []
            for tool_json in ag_schema.get('tools', []):
                tool = create_tool(tool_json)
                if tool:
                    tools.append(tool)
            agent = create_react_agent(
                name=ag_schema.get('name'),
                model=model,
                tools=[*tools, *handoff_tools],
                prompt=ag_schema.get('system_prompt', '')
            )
            agents.append(agent)
        agent_names = [ag.get('name') for ag in agent_schemas]
        last_agent = None
        for message in messages[::-1]:
            if message.get('role') == 'assistant':
                if message.get('name') in agent_names:
                    last_agent = message.get('name')
                break
        print('👇last_agent', last_agent)
        swarm = create_swarm(
            agents=agents,
            default_active_agent=last_agent if last_agent else agent_schemas[0]['name']
        ).compile()

        # swarm = create_swarm(
        #     agents=agents,
        #     default_active_agent=agent_schemas[0]['name']
        # ).compile()

        ctx = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            'model_info': {
                'image': image_model,
                'video': video_model
            },
        }
        tool_calls: list[ToolCall] = []
        last_saved_message_index = len(messages) - 1

        # Clean up incomplete tool calls to prevent LangGraph and OpenAI validation errors
        def clean_messages_for_langgraph(messages):
            """Remove incomplete tool calls and orphaned tool messages for OpenAI API compliance"""
            cleaned_messages = []
            tool_call_to_response = {}  # Map tool call IDs to their responses
            
            # First pass: identify all tool call -> tool response pairs
            for message in messages:
                if message.get('role') == 'assistant' and message.get('tool_calls'):
                    # Track tool calls
                    for tool_call in message.get('tool_calls', []):
                        tool_call_id = tool_call.get('id')
                        if tool_call_id:
                            tool_call_to_response[tool_call_id] = None  # Mark as pending
                            
                elif message.get('role') == 'tool':
                    # Mark tool call as completed if we find its response
                    tool_call_id = message.get('tool_call_id')
                    if tool_call_id and tool_call_id in tool_call_to_response:
                        tool_call_to_response[tool_call_id] = message
            
            # Second pass: only include messages that form complete tool call pairs
            i = 0
            while i < len(messages):
                message = messages[i]
                
                if message.get('role') == 'assistant' and message.get('tool_calls'):
                    # Check if ALL tool calls in this message have responses
                    tool_calls = message.get('tool_calls', [])
                    all_complete = True
                    
                    for tool_call in tool_calls:
                        tool_call_id = tool_call.get('id')
                        if tool_call_id not in tool_call_to_response or tool_call_to_response[tool_call_id] is None:
                            all_complete = False
                            break
                    
                    if all_complete:
                        # Include the assistant message with tool calls
                        cleaned_messages.append(message)
                        
                        # Include all corresponding tool responses
                        for tool_call in tool_calls:
                            tool_call_id = tool_call.get('id')
                            if tool_call_id and tool_call_to_response[tool_call_id]:
                                cleaned_messages.append(tool_call_to_response[tool_call_id])
                    
                    # Skip any following tool messages as they're handled above
                    i += 1
                    while i < len(messages) and messages[i].get('role') == 'tool':
                        i += 1
                    continue
                    
                elif message.get('role') == 'tool':
                    # Skip standalone tool messages - they're handled with their assistant messages
                    pass
                    
                else:
                    # Include user, system, and regular assistant messages
                    cleaned_messages.append(message)
                
                i += 1
            
            return cleaned_messages

        # Clean messages before passing to LangGraph
        cleaned_messages = clean_messages_for_langgraph(messages)
        print(f"👇 Cleaned {len(messages)} messages to {len(cleaned_messages)} for LangGraph")

        async def process_swarm_stream(messages_to_use):
            """Process the swarm stream with given messages"""
            nonlocal last_saved_message_index
            async for chunk in swarm.astream(
                {"messages": messages_to_use},
                config=ctx,
                stream_mode=["messages", "custom", 'values']
            ):
                chunk_type = chunk[0]
                if chunk_type == 'values':
                    all_messages = chunk[1].get('messages', [])
                    oai_messages = convert_to_openai_messages(all_messages)
                    await send_to_websocket(session_id, {
                            'type': 'all_messages',
                            'messages': oai_messages
                        })
                    for i in range(last_saved_message_index + 1, len(oai_messages)):
                        new_message = oai_messages[i]
                        await db_service.create_message(session_id, new_message.get('role', 'user'), json.dumps(new_message)) if len(messages) > 0 else None
                        last_saved_message_index = i
                else:
                    # Access the AIMessageChunk
                    ai_message_chunk: AIMessageChunk = chunk[1][0]
                    # print('👇ai_message_chunk', ai_message_chunk)
                    content = ai_message_chunk.content  # Get the content from the AIMessageChunk
                    if isinstance(ai_message_chunk, ToolMessage):
                        print('👇tool_call_results', ai_message_chunk.content)
                    elif content:
                        await send_to_websocket(session_id, {
                            'type': 'delta',
                            'text': content
                        })
                    elif hasattr(ai_message_chunk, 'tool_calls') and ai_message_chunk.tool_calls and ai_message_chunk.tool_calls[0].get('name'):
                        tool_calls = [tc for tc in ai_message_chunk.tool_calls if tc.get('name')]
                        print('😘tool_call event', ai_message_chunk.tool_calls)
                        for tool_call in tool_calls:
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
                                # print('👇tool_call_arguments event', for_tool_call, 'chunk', tool_call_chunk)
                                await send_to_websocket(session_id, {
                                    'type': 'tool_call_arguments',
                                    'id': for_tool_call.get('id'),
                                    'text': tool_call_chunk.get('args')
                                })
                    else:
                        print('👇no tool_call_chunks', chunk)

        # Try to process with cleaned messages first
        try:
            await process_swarm_stream(cleaned_messages)
        except (ValueError, Exception) as e:
            error_msg = str(e)
            if ("Found AIMessages with tool_calls that do not have a corresponding ToolMessage" in error_msg or 
                "messages with role 'tool' must be a response to a preceeding message with 'tool_calls'" in error_msg):
                print(f"🚨 Message validation error, starting fresh session: {error_msg}")
                # Start with a fresh session - only keep the last user message
                user_messages = [msg for msg in messages if msg.get('role') == 'user']
                if user_messages:
                    fresh_messages = [user_messages[-1]]  # Keep only the latest user message
                    print(f"👇 Starting fresh with last user message: {len(fresh_messages)} messages")
                    await process_swarm_stream(fresh_messages)
                else:
                    # No user messages, send error
                    await send_to_websocket(session_id, {
                        'type': 'error',
                        'error': 'Chat session corrupted. Please start a new conversation.'
                    })
                    return
            else:
                raise e  # Re-raise other errors

        # 发送完成事件
        await send_to_websocket(session_id, {
            'type': 'done'
        })

    except Exception as e:
        print('Error in langgraph_agent', e)
        tb_str = traceback.format_exc()
        print(f"Full traceback:\n{tb_str}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
