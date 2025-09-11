# services/magic_service.py

# Import necessary modules
import asyncio
import json
from typing import Dict, Any, List, Optional

# Import service modules
from services.db_service import db_service
# from services.OpenAIAgents_service import create_jaaz_response
from services.OpenAIAgents_service import create_local_magic_response
from services.websocket_service import send_to_websocket  # type: ignore
from services.stream_service import add_stream_task, remove_stream_task
from services.points_service import points_service, InsufficientPointsError
from log import get_logger

logger = get_logger(__name__)

async def handle_magic(data: Dict[str, Any]) -> None:
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
    system_prompt: str = data.get('system_prompt', '')
    template_id: str = data.get('template_id', '')
    user_info: Dict[str, Any] = data.get('user_info', {})
    
    # Validate required fields
    if not session_id or session_id.strip() == '':
        logger.error("[error] session_id is required but missing or empty")
        raise ValueError("session_id is required")
    
    # Extract user information
    user_uuid = user_info.get('uuid') if user_info else None
    user_id = user_info.get('id') if user_info else None

    # 🎯 积分检查：画图前检查是否有足够积分
    if user_id and user_uuid:
        try:
            await points_service.check_and_reserve_image_generation_points(user_id, user_uuid)
            logger.info(f"✅ 积分检查通过，用户 {user_id} 可以进行画图")
        except InsufficientPointsError as e:
            logger.warning(f"❌ 积分不足，用户 {user_id}: {e.message}")
            # 通过WebSocket返回积分不足错误
            await send_to_websocket(session_id, {
                'type': 'error',
                'error': e.message,
                'error_code': 'insufficient_points',
                'current_points': e.current_points,
                'required_points': e.required_points
            })
            return  # 直接返回，不进行画图
    else:
        logger.warning(f"⚠️ 用户信息不完整，跳过积分检查: user_id={user_id}, user_uuid={user_uuid}")

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

    # Save user message to database
    if len(messages) > 0:
        await db_service.create_message(
            session_id, messages[-1].get('role', 'user'), json.dumps(messages[-1]), user_uuid
        )

    
    # 注释掉模版图片推送，因为前端现在通过localStorage立即显示用户消息
    # 这样可以避免重复显示和提高响应速度
    # if template_id:
    #     # 先推送用户上传的图片到前端显示
    #     await _push_user_images_to_frontend(messages, session_id, template_id)

    # Create and start magic generation task
    # 从data中获取用户信息，如果有的话
    user_info = data.get('user_info')
    task = asyncio.create_task(_process_magic_generation(messages, session_id, canvas_id, system_prompt, template_id, user_uuid, user_info))

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


async def _process_magic_generation(
    messages: List[Dict[str, Any]],
    session_id: str,
    canvas_id: str,
    system_prompt: str = "",
    template_id: str = "",
    user_uuid: Optional[str] = None,
    user_info: Optional[Dict[str, Any]] = None
) -> None:
    """
    Process magic generation in a separate async task.

    Args:
        messages: List of messages
        session_id: Session ID
        canvas_id: Canvas ID
    """
    try:
        # 🔥 发送开始生成通知
        await send_to_websocket(session_id, {
            'type': 'generation_progress',
            'status': 'starting',
            'message': '🎨 正在生成魔法图片...'
        })
        
        # 🔥 发送图像处理通知
        await send_to_websocket(session_id, {
            'type': 'generation_progress', 
            'status': 'processing',
            'message': '📝 正在分析和处理图像...'
        })
        
        # 原来是基于云端生成
        # ai_response = await create_jaaz_response(messages, session_id, canvas_id)
        ai_response = await create_local_magic_response(messages, session_id, canvas_id, template_id=template_id, user_info=user_info)
        
        # 🎯 画图成功后扣除积分
        if user_info and user_info.get('id') and user_info.get('uuid'):
            logger.info(f"🎯 [DEBUG] 魔法画图成功，开始积分扣除流程: user_id={user_info.get('id')}")
            try:
                deduction_result = await points_service.deduct_image_generation_points(
                    user_id=user_info.get('id'),
                    user_uuid=user_info.get('uuid'),
                    session_id=session_id
                )
                if deduction_result['success']:
                    logger.info(f"✅ 魔法画图积分扣除成功: {deduction_result['message']}")
                    # 通过WebSocket通知前端积分变化
                    notification_message = {
                        'type': 'points_deducted',
                        'points_deducted': deduction_result['points_deducted'],
                        'balance_after': deduction_result['balance_after'],
                        'message': f"画图完成，扣除{deduction_result['points_deducted']}积分，剩余{deduction_result['balance_after']}积分"
                    }
                    logger.info(f"📡 [DEBUG] 准备发送魔法画图积分扣除通知: {notification_message}")
                    
                    await send_to_websocket(session_id, notification_message)
                    logger.info(f"📡 [DEBUG] 魔法画图积分扣除通知已发送到session: {session_id}")
                else:
                    logger.error(f"❌ 魔法画图积分扣除失败: {deduction_result['message']}")
            except Exception as e:
                logger.error(f"❌ 扣除魔法画图积分时发生错误: {e}")
        else:
            logger.warning(f"⚠️ [DEBUG] 魔法画图完成但用户信息不完整，跳过积分扣除: user_info={user_info}")
        
        # 🔥 发送完成通知
        await send_to_websocket(session_id, {
            'type': 'generation_progress',
            'status': 'completed', 
            'message': '✨ 魔法生成完成！'
        })
        
    except Exception as e:
        logger.error(f"❌ 魔法生成失败: {e}")
        # 🔥 发送错误通知 
        await send_to_websocket(session_id, {
            'type': 'generation_progress',
            'status': 'error',
            'message': f'❌ 生成失败: {str(e)}'
        })
        # 重新抛出异常以保持原有错误处理逻辑
        raise

    # Save AI response to database
    await db_service.create_message(session_id, 'assistant', json.dumps(ai_response), user_uuid)

    # Send messages to frontend immediately
    all_messages = messages + [ai_response]
    await send_to_websocket(
        session_id, {'type': 'all_messages', 'messages': all_messages}
    )
