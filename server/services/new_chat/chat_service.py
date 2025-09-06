# services/magic_service.py

# Import necessary modules
import asyncio
import json
import time
import uuid
from typing import Dict, Any, List, Optional

# Import service modules
from models.tool_model import ToolInfoJson
from services.db_service import db_service
from services.config_service import USER_DATA_DIR, DEFAULT_PROVIDERS_CONFIG
# from services.OpenAIAgents_service import create_jaaz_response
from services.new_chat import create_local_response
from services.websocket_service import send_to_websocket  # type: ignore
from services.stream_service import add_stream_task, remove_stream_task
from log import get_logger
from models.config_model import ModelInfo


logger = get_logger(__name__)

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
    Handle an incoming magic generation request.

    Workflow:
    - Parse incoming magic generation data.
    - Run Agents.
    - Save magic session and messages to the database.
    - Notify frontend via WebSocket.

    Args:
        data (dict): Magic generation request data containing:
            - messages: list of message dicts
            - session_id: unique session identifier
            - canvas_id: canvas identifier (contextual use)
            - text_model: text model configuration
            - tool_list: list of tool model configurations (images/videos)
    """
    # Extract fields from incoming data
    messages: List[Dict[str, Any]] = data.get('messages', [])
    session_id: str = data.get('session_id', '')
    canvas_id: str = data.get('canvas_id', '')
    template_id: str = data.get('template_id', '')
    user_info: Dict[str, Any] = data.get('user_info', {})
    model_name: str = data.get('model_name', '')
    text_model_data = data.get('text_model')
    
    # 添加详细的调试信息
    logger.info(f"🔍 [DEBUG] 前端传入的完整请求数据 keys: {list(data.keys())}")
    logger.info(f"🔍 [DEBUG] 前端传入的 model_name: '{model_name}'")
    logger.info(f"🔍 [DEBUG] 前端传入的 text_model: {text_model_data}")
    
    # 类型安全检查：确保 model_name 是字符串
    if isinstance(model_name, dict):
        logger.warning(f"🚨 [WARNING] model_name 是字典类型，尝试提取 modelName 字段: {model_name}")
        if 'modelName' in model_name:
            model_name = model_name['modelName']
            logger.info(f"🔧 [DEBUG] 从字典中提取模型名称: {model_name}")
        else:
            model_name = ''
            logger.warning(f"🚨 [WARNING] 字典中没有 modelName 字段，重置为空字符串")
    
    # 如果没有传递模型名称，尝试从 text_model 中提取
    if not model_name:
        if text_model_data and isinstance(text_model_data, dict):
            model_name = text_model_data.get('model', '')
            logger.info(f"🔍 [DEBUG] 从 text_model 中提取模型名称: {model_name}")
        
        # 如果还是没有，使用默认值
        if not model_name:
            model_name = 'gpt-4o'
            logger.info(f"🔍 [DEBUG] 使用默认模型: {model_name}")
        else:
            logger.info(f"🔍 [DEBUG] 成功提取模型名称: {model_name}")
    
    # 最终验证：确保 model_name 是字符串类型
    if not isinstance(model_name, str):
        logger.error(f"🚨 [ERROR] model_name 类型错误，期望字符串，实际收到: {type(model_name)}, 值: {model_name}")
        model_name = 'gpt-4o'  # 强制使用默认值
        logger.info(f"🔧 [DEBUG] 强制使用默认模型: {model_name}")
    
    # 根据模型名称确定提供商
    provider = ''
    if 'gpt' in model_name.lower() or 'openai' in model_name.lower():
        provider = 'openai'
    elif 'gemini' in model_name.lower() or 'google' in model_name.lower():
        provider = 'google'
    elif 'claude' in model_name.lower() or 'anthropic' in model_name.lower():
        provider = 'anthropic'
    else:
        provider = 'openai'  # 默认提供商
    
    logger.info(f"🎯 [DEBUG] 解析出的 provider: '{provider}', model_name: '{model_name}'")
        
    # 使用智能配置匹配获取完整配置
    text_model = dict(find_model_config(provider, model_name))
    logger.info(f"[debug] 将工具模型转换为文本模型: {provider}/{model_name} -> {text_model.get('provider', '')}/{text_model.get('model', '')} (URL: {text_model.get('url', '')})")
    
    # Validate required fields
    if not session_id or session_id.strip() == '':
        logger.error("[error] session_id is required but missing or empty")
        raise ValueError("session_id is required")
    
    # Extract user information
    user_uuid = user_info.get('uuid') if user_info else None

    # print('✨ magic_service 接收到数据:', {
    #     'session_id': session_id,
    #     'canvas_id': canvas_id,
    #     'messages_count': len(messages),
    # })

    # If there is only one message, create a new magic session
    if len(messages) == 1:
        # create new session (只有在session不存在时才创建)
        prompt = messages[0].get('content', '')
        try:
            title = prompt[:200] if isinstance(prompt, str) else ''
            await db_service.create_chat_session(session_id, 'gpt', 'jaaz', canvas_id, user_uuid, title)
        except Exception as e:
            # 如果session已存在，忽略错误
            if "UNIQUE constraint failed" in str(e):
                logger.warn(f"Session {session_id} already exists, skipping creation")
            else:
                raise e

    # 🔥 关键修复：获取历史消息，确保不清空历史对话
    # 先获取当前会话的历史消息（get_chat_history返回已解析的消息列表）
    parsed_history = []
    try:
        chat_history = await db_service.get_chat_history(session_id, user_uuid)
        logger.info(f"[DEBUG] 获取到历史消息数量: {len(chat_history)}")
        
        # get_chat_history已经返回解析后的消息列表，直接使用
        for i, history_message in enumerate(chat_history):
            try:
                # 确保消息格式正确
                if not isinstance(history_message, dict):
                    logger.warning(f"[WARNING] 历史消息 {i} 不是字典格式: {type(history_message)}")
                    continue
                
                # 确保消息有基本字段，如果没有就添加
                if 'timestamp' not in history_message:
                    history_message['timestamp'] = int(time.time() * 1000) - len(chat_history) + i
                
                if 'message_id' not in history_message:
                    history_message['message_id'] = f"{session_id}_{history_message.get('timestamp', i)}_{str(uuid.uuid4())[:8]}"
                
                parsed_history.append(history_message)
                logger.info(f"[DEBUG] 历史消息 {i}: {history_message.get('role', 'unknown')} - {str(history_message.get('content', ''))[:50]}...")
                
            except Exception as e:
                logger.error(f"[ERROR] 处理历史消息 {i} 时出错: {e}, 数据: {history_message}")
                continue
    except Exception as e:
        logger.error(f"[ERROR] 获取历史消息失败: {e}")
        # 如果获取历史失败，使用空历史
    
    # Save user message to database and immediately send to frontend
    enhanced_user_message = None
    if len(messages) > 0:
        # 为用户消息添加唯一时间戳，确保相同内容的消息也能被正确区分
        user_message = messages[-1].copy()  # 创建副本避免修改原消息
        user_message['timestamp'] = int(time.time() * 1000)  # 添加毫秒级时间戳
        user_message['message_id'] = f"{session_id}_{user_message['timestamp']}_{str(uuid.uuid4())[:8]}"  # 添加唯一消息ID
        enhanced_user_message = user_message
        
        await db_service.create_message(
            session_id, user_message.get('role', 'user'), json.dumps(user_message), user_uuid
        )
        
        # 🔥 关键修复：发送包含完整历史的消息列表，保留历史对话
        # 将新用户消息添加到历史消息列表中
        complete_messages = parsed_history + [user_message]
        logger.info(f"[DEBUG] 立即发送用户消息到前端，总消息数: {len(complete_messages)}")
        logger.info(f"[DEBUG] 新用户消息: {user_message.get('content', '')[:50]}...")
        
        try:
            await send_to_websocket(session_id, {
                'type': 'all_messages', 
                'messages': complete_messages  # 发送完整历史 + 新用户消息
            })
            logger.info(f"[DEBUG] ✅ 用户消息发送成功")
        except Exception as e:
            logger.error(f"[ERROR] ❌ 用户消息发送失败: {e}")
            # 即使 WebSocket 发送失败，也要继续处理

    
    # 如果是模版生成，先发送一张图片到前端
    if template_id:
        # 先推送用户上传的图片到前端显示
        await _push_user_images_to_frontend(messages, session_id, template_id)

    # Create and start magic generation task
    task = asyncio.create_task(_process_generation(messages, session_id, canvas_id, model_name, user_uuid, user_info, enhanced_user_message))

    # Register the task in stream_tasks (for possible cancellation)
    add_stream_task(session_id, task)
    try:
        # Await completion of the magic generation task
        await task
    except asyncio.exceptions.CancelledError:
        logger.warn(f"🛑Magic generation session {session_id} cancelled")
    finally:
        # Always remove the task from stream_tasks after completion/cancellation
        remove_stream_task(session_id)
        # Notify frontend WebSocket that magic generation is done
        await send_to_websocket(session_id, {'type': 'done'})

    print('✨ magic_service 处理完成')


async def _push_user_images_to_frontend(messages: List[Dict[str, Any]], session_id: str, template_id: str) -> None:
    """
    推送用户上传的图片到前端canvas页面显示
    
    Args:
        messages: 用户消息列表
        session_id: 会话ID
    """
    try:
        # 获取最后一条用户消息
        if not messages:
            return
            
        user_message = messages[-1]
        if user_message.get('role') != 'user':
            return
            
        content = user_message.get('content', [])
        if not isinstance(content, list):
            return
            
        # 提取所有图片内容
        user_images = []
        text_content = ""

        # 根据template_id获取template_name
        template_name = "未知模板"
        if template_id:
            try:
                from routers.templates_router import TEMPLATES
                template_id_int = int(template_id)
                template = next((t for t in TEMPLATES if t["id"] == template_id_int), None)
                if template:
                    template_name = template.get("title", "未知模板")
            except (ValueError, ImportError):
                logger.error("出错了...")
        
        for content_item in content:
            if content_item.get('type') == 'image_url':
                image_url = content_item.get('image_url', {}).get('url', '')
                if image_url:
                    user_images.append({
                        'type': 'image_url',
                        'image_url': {'url': image_url}
                    })
            elif content_item.get('type') == 'text':
                text_content = content_item.get('text', '')
        
        if user_images:
            # 构造包含用户图片的消息
            user_image_message = {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': f'📸 使用模版: {template_name} 画图'
                    }
                ] + user_images
            }
            
            # 通过websocket推送到前端
            await send_to_websocket(session_id, {
                'type': 'user_images', 
                'message': user_image_message
            })
            
            logger.info(f"✅ 已推送 {len(user_images)} 张用户图片到前端")
            
    except Exception as e:
        logger.error(f"❌ 推送用户图片失败: {e}")


async def _process_generation(
    messages: List[Dict[str, Any]],
    session_id: str,
    canvas_id: str,
    model_name: str,
    user_uuid: Optional[str] = None,
    user_info: Optional[Dict[str, Any]] = None,
    enhanced_user_message: Optional[Dict[str, Any]] = None
) -> None:
    """
    Process generation in a separate async task.

    Args:
        messages: List of messages
        session_id: Session ID
        canvas_id: Canvas ID
    """

    # 原来是基于云端生成
    # ai_response = await create_jaaz_response(messages, session_id, canvas_id)
    ai_response = await create_local_response(messages, session_id, canvas_id, model_name, user_info)

    # 为AI响应添加唯一时间戳和消息ID
    ai_response_with_id = ai_response.copy()  # 创建副本
    ai_response_with_id['timestamp'] = int(time.time() * 1000)  # 添加毫秒级时间戳
    ai_response_with_id['message_id'] = f"{session_id}_{ai_response_with_id['timestamp']}_{str(uuid.uuid4())[:8]}"  # 添加唯一消息ID
    
    # Save AI response to database
    await db_service.create_message(session_id, 'assistant', json.dumps(ai_response_with_id), user_uuid)

    # 🔥 关键修复：再次获取历史消息（包括刚才保存的AI响应），发送完整对话
    # 重新获取完整历史，包括刚保存的AI响应（get_chat_history返回已解析的消息列表）
    final_parsed_history = []
    try:
        updated_chat_history = await db_service.get_chat_history(session_id, user_uuid)
        logger.info(f"[DEBUG] AI响应后获取到历史消息数量: {len(updated_chat_history)}")
        
        # get_chat_history已经返回解析后的消息列表，直接使用
        for i, history_message in enumerate(updated_chat_history):
            try:
                # 确保消息格式正确
                if not isinstance(history_message, dict):
                    logger.warning(f"[WARNING] AI响应后历史消息 {i} 不是字典格式: {type(history_message)}")
                    continue
                
                # 确保消息有基本字段，如果没有就添加
                if 'timestamp' not in history_message:
                    history_message['timestamp'] = int(time.time() * 1000) - len(updated_chat_history) + i
                
                if 'message_id' not in history_message:
                    history_message['message_id'] = f"{session_id}_{history_message.get('timestamp', i)}_{str(uuid.uuid4())[:8]}"
                
                final_parsed_history.append(history_message)
                logger.info(f"[DEBUG] AI响应后历史消息 {i}: {history_message.get('role', 'unknown')} - {str(history_message.get('content', ''))[:50]}...")
                
            except Exception as e:
                logger.error(f"[ERROR] 处理AI响应后历史消息 {i} 时出错: {e}, 数据: {history_message}")
                continue
    except Exception as e:
        logger.error(f"[ERROR] 获取AI响应后历史消息失败: {e}")
        # 如果获取失败，至少发送AI响应
        final_parsed_history = [ai_response_with_id]
    
    # 发送包含完整历史的消息列表（包括用户消息和AI响应）
    await send_to_websocket(session_id, {
        'type': 'all_messages', 
        'messages': final_parsed_history
    })
