# services/chat_service.py

# Import necessary modules
import asyncio
import json
import time
from typing import Dict, Any, List, Optional

# Import service modules
from models.tool_model import ToolInfoJson
from services.db_service import db_service
from services.db_optimization_service import get_db_optimization_service
from services.config_service import USER_DATA_DIR, DEFAULT_PROVIDERS_CONFIG
from services.langgraph_service import langgraph_multi_agent
from services.websocket_service import send_to_websocket
from services.stream_service import add_stream_task, remove_stream_task
from models.config_model import ModelInfo
from log import get_logger
import os

logger = get_logger(__name__)

# 获取优化的数据库服务实例
DB_PATH = os.path.join(USER_DATA_DIR, "localmanus.db")
db_opt_service = get_db_optimization_service(DB_PATH)


def find_model_config(provider: str, model_name: str) -> ModelInfo:
    """
    根据 provider 和 model 名称从 DEFAULT_PROVIDERS_CONFIG 中查找完整的模型配置
    
    Args:
        provider: 模型提供商 (如 'google', 'openai')
        model_name: 模型名称 (如 'gemini-2.5-flash-image')
        
    Returns:
        完整的 ModelInfo 配置
    """
    
    # 首先尝试精确匹配
    if provider in DEFAULT_PROVIDERS_CONFIG:
        provider_config = DEFAULT_PROVIDERS_CONFIG[provider]
        models = provider_config.get('models', {})
        if model_name in models:
            return {
                'provider': provider,
                'model': model_name,
                'url': provider_config.get('url', ''),
                'type': 'text'  # 强制设置为文本类型
            }
            
    # 如果精确匹配失败，尝试模糊匹配
    for config_provider, provider_config in DEFAULT_PROVIDERS_CONFIG.items():
        models = provider_config.get('models', {})
        for config_model in models.keys():
            # 检查模型名称是否包含关键词
            if (provider.lower() in config_provider.lower() or 
                config_provider.lower() in provider.lower() or
                model_name.lower() in config_model.lower() or
                config_model.lower() in model_name.lower()):
                
                logger.info(f"[debug] 模糊匹配成功: {provider}/{model_name} -> {config_provider}/{config_model}")
                return {
                    'provider': config_provider,
                    'model': config_model,
                    'url': provider_config.get('url', ''),
                    'type': 'text'
                }
    
    # 如果都没找到，使用默认配置
    logger.warning(f"[warning] 未找到匹配的模型配置: {provider}/{model_name}，使用默认配置")
    
    # 如果提供商存在，使用该提供商的第一个文本模型
    if provider in DEFAULT_PROVIDERS_CONFIG:
        provider_config = DEFAULT_PROVIDERS_CONFIG[provider]
        models = provider_config.get('models', {})
        text_models = {k: v for k, v in models.items() if v.get('type') == 'text'}
        if text_models:
            first_model = next(iter(text_models.keys()))
            return {
                'provider': provider,
                'model': first_model,
                'url': provider_config.get('url', ''),
                'type': 'text'
            }
    
    # 最后的备选方案：使用 OpenAI
    openai_config = DEFAULT_PROVIDERS_CONFIG.get('openai', {})
    openai_models = openai_config.get('models', {})
    first_openai_model = next(iter(openai_models.keys())) if openai_models else 'gpt-4o-mini'
    
    return {
        'provider': 'openai',
        'model': first_openai_model,
        'url': openai_config.get('url', 'https://api.openai.com/v1'),
        'type': 'text'
    }


async def handle_chat(data: Dict[str, Any]) -> None:
    """
    Handle an incoming chat request.

    Workflow:
    - Parse incoming chat data.
    - Optionally inject system prompt.
    - Save chat session and messages to the database.
    - Launch langgraph_agent task to process chat.
    - Manage stream task lifecycle (add, remove).
    - Notify frontend via WebSocket when stream is done.

    Args:
        data (dict): Chat request data containing:
            - messages: list of message dicts
            - session_id: unique session identifier
            - canvas_id: canvas identifier (contextual use)
            - text_model: text model configuration
            - tool_list: list of tool model configurations (images/videos)
            - user_info: user information (optional)
    """
    start_time = time.time()
    logger.info(f"[debug] === 开始处理聊天请求 ===")
    
    # Extract fields from incoming data
    messages: List[Dict[str, Any]] = data.get('messages', [])
    session_id: str = data.get('session_id', '')
    canvas_id: str = data.get('canvas_id', '')
    text_model_raw = data.get('text_model', None)
    tool_list: List[ToolInfoJson] = data.get('tool_list', [])
    template_id: str = data.get('template_id', '')
    user_info: Dict[str, Any] = data.get('user_info', {})
    
    # 智能模型选择：如果没有文本模型，将第一个工具模型转换为文本模型
    text_model: ModelInfo
    if text_model_raw and isinstance(text_model_raw, dict) and 'provider' in text_model_raw and 'model' in text_model_raw:
        # 有文本模型，直接使用
        text_model = text_model_raw
        logger.info(f"[debug] 使用文本模型: {text_model.get('provider', '')}/{text_model.get('model', '')}")
    elif tool_list and len(tool_list) > 0:
        # 没有文本模型但有工具模型，将第一个工具模型转换为文本模型
        first_tool = tool_list[0]
        provider = first_tool.get('provider', '')
        model_name = first_tool.get('display_name') or first_tool.get('id', '')
        
        # 使用智能配置匹配获取完整配置
        text_model = dict(find_model_config(provider, model_name))
        logger.info(f"[debug] 将工具模型转换为文本模型: {provider}/{model_name} -> {text_model.get('provider', '')}/{text_model.get('model', '')} (URL: {text_model.get('url', '')})")
    else:
        # 既没有文本模型也没有工具模型，使用默认配置
        logger.warning("[warning] 既没有文本模型也没有工具模型，使用默认 OpenAI 配置")
        text_model = dict(find_model_config('openai', 'gpt-4o-mini'))
    
    # Validate required fields
    if not session_id or session_id.strip() == '':
        logger.error("[error] session_id is required but missing or empty")
        raise ValueError("session_id is required")
    
    # Extract user information
    user_uuid = user_info.get('uuid') if user_info else None
    
    logger.info(f"[debug] 请求参数: session_id={session_id}, canvas_id={canvas_id}, user_uuid={user_uuid}")
    logger.info(f"[debug] 消息数量: {len(messages)}, 工具数量: {len(tool_list)}")
    logger.info(f"[debug] 最终使用的文本模型: {text_model.get('provider', '')}/{text_model.get('model', '')}")

    # If template_id is provided, get template prompt
    template_start = time.time()
    template_prompt: Optional[str] = None
    if template_id:
        from routers.templates_router import TEMPLATES
        template = next((t for t in TEMPLATES if t["id"] == int(template_id)), None)
        if template:
            template_prompt = template.get("prompt")
            logger.info(f"[debug] 模板加载耗时: {(time.time() - template_start) * 1000:.2f}ms")

    # TODO: save and fetch system prompt from db or settings config
    system_prompt: Optional[str] = data.get('system_prompt')

    # Database operations - 优化为批量操作
    db_start = time.time()
    
    # 收集所有需要执行的数据库操作
    db_operations = []
    
    # If there is only one message, create a new chat session
    if len(messages) == 1:
        # create new session
        prompt = messages[0].get('content', '')
        title = prompt[:200] if isinstance(prompt, str) else ''
        # 正确传递参数：id, model, provider, canvas_id, user_uuid, title
        await db_service.create_chat_session(session_id, text_model.get('model', ''), text_model.get('provider', ''), canvas_id, user_uuid, title)
        logger.info(f"[debug] 创建聊天会话: session_id={session_id}, user_uuid={user_uuid}")

    # 批量创建消息
    if len(messages) > 0:
        # 为了简化，我们仍然使用单个消息创建，但添加了性能监控
        await db_service.create_message(session_id, messages[-1].get('role', 'user'), json.dumps(messages[-1]), user_uuid)
    
    logger.info(f"[debug] 数据库操作耗时: {(time.time() - db_start) * 1000:.2f}ms")
    
    # 获取数据库性能统计
    db_stats = await db_opt_service.get_stats()
    logger.info(f"[debug] 数据库统计: {db_stats}")

    # 立即推送用户消息到前端（确保用户看到自己的输入）
    if len(messages) > 0:
        user_message = messages[-1]  # 最后一条消息通常是用户输入
        if user_message.get('role') == 'user':
            logger.info(f"[debug] 立即推送用户消息到前端")
            await send_to_websocket(session_id, {
                'type': 'all_messages',
                'messages': messages  # 发送包含用户消息的完整列表
            })

    # Create and start langgraph_agent task for chat processing
    task_start = time.time()
    task = asyncio.create_task(langgraph_multi_agent(
        messages, canvas_id, session_id, text_model, tool_list, system_prompt, template_id, template_prompt, user_uuid))
    logger.info(f"[debug] 任务创建耗时: {(time.time() - task_start) * 1000:.2f}ms")

    # Register the task in stream_tasks (for possible cancellation)
    add_stream_task(session_id, task)
    logger.info(f"[debug] 请求预处理总耗时: {(time.time() - start_time) * 1000:.2f}ms")
    
    try:
        # Await completion of the langgraph_agent task
        agent_start = time.time()
        await task
        logger.info(f"[debug] Agent处理耗时: {(time.time() - agent_start) * 1000:.2f}ms")
    except asyncio.exceptions.CancelledError:
        logger.info(f"[debug] Session {session_id} cancelled during stream")
    finally:
        # Always remove the task from stream_tasks after completion/cancellation
        remove_stream_task(session_id)
        # Notify frontend WebSocket that chat processing is done
        await send_to_websocket(session_id, {
            'type': 'done'
        })
        logger.info(f"[debug] === 聊天请求处理完成，总耗时: {(time.time() - start_time) * 1000:.2f}ms ===")
