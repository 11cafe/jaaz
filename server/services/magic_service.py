# services/magic_service.py

# Import necessary modules
import asyncio
import json
from typing import Dict, Any, List

# Import service modules
from services.db_service import db_service
# from services.OpenAIAgents_service import create_jaaz_response
from services.OpenAIAgents_service import create_local_magic_response
from services.websocket_service import send_to_websocket  # type: ignore
from services.stream_service import add_stream_task, remove_stream_task


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
            await db_service.create_chat_session(session_id, 'gpt', 'jaaz', canvas_id, (prompt[:200] if isinstance(prompt, str) else ''))
        except Exception as e:
            # 如果session已存在，忽略错误
            if "UNIQUE constraint failed" in str(e):
                print(f"Session {session_id} already exists, skipping creation")
            else:
                raise e

    # Save user message to database
    if len(messages) > 0:
        await db_service.create_message(
            session_id, messages[-1].get('role', 'user'), json.dumps(messages[-1])
        )

    
    # 如果是模版生成，先发送一张图片到前端
    if template_id:
        # 先推送用户上传的图片到前端显示
        await _push_user_images_to_frontend(messages, session_id, template_id)

    # Create and start magic generation task
    task = asyncio.create_task(_process_magic_generation(messages, session_id, canvas_id, system_prompt, template_id))

    # Register the task in stream_tasks (for possible cancellation)
    add_stream_task(session_id, task)
    try:
        # Await completion of the magic generation task
        await task
    except asyncio.exceptions.CancelledError:
        print(f"🛑Magic generation session {session_id} cancelled")
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
                print("出错了...")
        
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
            
            print(f"✅ 已推送 {len(user_images)} 张用户图片到前端")
            
    except Exception as e:
        print(f"❌ 推送用户图片失败: {e}")


async def _process_magic_generation(
    messages: List[Dict[str, Any]],
    session_id: str,
    canvas_id: str,
    system_prompt: str = "",
    template_id: str = ""
) -> None:
    """
    Process magic generation in a separate async task.

    Args:
        messages: List of messages
        session_id: Session ID
        canvas_id: Canvas ID
    """

    # 原来是基于云端生成
    # ai_response = await create_jaaz_response(messages, session_id, canvas_id)
    ai_response = await create_local_magic_response(messages, session_id, canvas_id, template_id=template_id)

    # Save AI response to database
    await db_service.create_message(session_id, 'assistant', json.dumps(ai_response))

    # Send messages to frontend immediately
    all_messages = messages + [ai_response]
    await send_to_websocket(
        session_id, {'type': 'all_messages', 'messages': all_messages}
    )
