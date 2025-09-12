# services/websocket_service.py
from services.websocket_state import sio, get_all_socket_ids, get_sockets_for_session, update_connection_session
import traceback
import time
from typing import Any, Dict, List, Literal, Optional, Tuple
from log import get_logger

logger = get_logger(__name__)


async def broadcast_session_update(session_id: str, canvas_id: str | None, event: Dict[str, Any]):
    try:
        # Validate session_id to prevent empty session_id from being broadcast
        if not session_id or session_id.strip() == '':
            logger.warn(f"⚠️ [WEBSOCKET] 尝试广播空session_id, event: {event}")
            return
        
        # 🔧 修复：只获取当前session的socket连接，而不是所有连接
        socket_ids = get_sockets_for_session(session_id)
        
        # 🔍 调试信息：显示当前所有连接状态
        all_sockets = get_all_socket_ids()
        logger.info(f"🔍 [WEBSOCKET_DEBUG] 当前总连接数: {len(all_sockets)}, 所有socket: {all_sockets}")
        logger.info(f"🔍 [WEBSOCKET_DEBUG] 查找session {session_id} 的注册socket...")
        
        # 🚨 紧急修复：如果没有找到session对应的socket，使用所有socket（恢复原始行为）
        if not socket_ids:
            logger.warning(f"⚠️ [WEBSOCKET] Session {session_id} 未注册到任何socket")
            logger.warning(f"⚠️ [WEBSOCKET] 当前所有socket: {all_sockets}")
            
            # 🔧 紧急修复：使用所有socket确保消息能到达前端（恢复聊天显示）
            socket_ids = all_sockets
            logger.warning(f"🚨 [WEBSOCKET] 紧急修复：使用所有socket确保消息到达: {socket_ids}")
            logger.warning(f"🚨 [WEBSOCKET] 这是临时方案，需要后续完善前端session注册")
        
        logger.info(f"📡 [WEBSOCKET] 准备广播到 {len(socket_ids)} 个socket: session_id={session_id}, event_type={event.get('type', 'unknown')}")
        logger.info(f"📡 [WEBSOCKET] 目标socket列表: {socket_ids}")
        
        if socket_ids:
            broadcast_message = {
                'canvas_id': canvas_id,
                'session_id': session_id,
                **event
            }
            
            # 计数器用于跟踪成功发送的消息
            successful_broadcasts = 0
            failed_broadcasts = 0
            
            for socket_id in socket_ids:
                try:
                    logger.info(f"📤 [WEBSOCKET_DEBUG] 发送消息到socket {socket_id}")
                    logger.info(f"📤 [WEBSOCKET_DEBUG] 消息类型: {event.get('type')}, session: {session_id}")
                    logger.info(f"📤 [WEBSOCKET_DEBUG] 消息内容预览: {str(broadcast_message)[:200]}...")
                    
                    await sio.emit('session_update', broadcast_message, room=socket_id)
                    successful_broadcasts += 1
                    logger.info(f"✅ [WEBSOCKET_DEBUG] 成功发送到socket {socket_id}")
                except Exception as socket_error:
                    failed_broadcasts += 1
                    logger.error(f"❌ [WEBSOCKET_DEBUG] 向socket {socket_id} 发送失败: {socket_error}")
                    logger.error(f"❌ [WEBSOCKET_DEBUG] 错误详情: {type(socket_error).__name__}: {socket_error}")
                    
            logger.info(f"📡 [WEBSOCKET] 广播完成: 成功 {successful_broadcasts}/{len(socket_ids)}, 失败 {failed_broadcasts}")
            
        else:
            logger.warning(f"⚠️ [WEBSOCKET] 没有找到session {session_id} 的socket连接，无法发送通知")
            
    except Exception as e:
        logger.error(f"❌ [WEBSOCKET] 广播session更新失败 {session_id}: {e}")
        logger.error(f"❌ [WEBSOCKET] 错误类型: {type(e).__name__}")
        traceback.print_exc()

# compatible with legacy codes
# TODO: All Broadcast should have a canvas_id


async def send_to_websocket(session_id: str, event: Dict[str, Any]):
    try:
        logger.info(f"📡 [WEBSOCKET] send_to_websocket 被调用: session_id={session_id}, event_type={event.get('type', 'unknown')}")
        await broadcast_session_update(session_id, None, event)
    except Exception as e:
        logger.error(f"❌ [WEBSOCKET] send_to_websocket 失败: session_id={session_id}, error={e}")
        logger.error(f"❌ [WEBSOCKET] 错误类型: {type(e).__name__}")
        traceback.print_exc()


async def broadcast_init_done():
    try:
        await sio.emit('init_done', {
            'type': 'init_done'
        })
        logger.info("Broadcasted init_done to all clients")
    except Exception as e:
        logger.error(f"Error broadcasting init_done: {e}")
        traceback.print_exc()


async def send_generation_status(
    session_id: str, 
    canvas_id: Optional[str] = None,
    status: Literal['started', 'progress', 'complete', 'error'] = 'progress',
    message: str = '',
    progress: float = 0.0,
    data: Optional[Dict[str, Any]] = None
):
    """
    发送生成状态更新
    
    Args:
        session_id: 会话ID
        canvas_id: 画布ID
        status: 状态类型
        message: 状态消息
        progress: 进度 (0.0-1.0)
        data: 额外数据
    """
    try:
        event_data = {
            'type': f'generation_{status}',
            'session_id': session_id,
            'canvas_id': canvas_id,
            'message': message,
            'progress': progress,
            'timestamp': int(time.time() * 1000)
        }
        
        if data:
            event_data['data'] = data
            
        await broadcast_session_update(session_id, canvas_id, event_data)
        logger.info(f"📤 发送生成状态: {session_id} - {status} ({progress:.1%}) - {message}")
        
    except Exception as e:
        logger.error(f"Error sending generation status: {e}")
        traceback.print_exc()


async def send_user_message_confirmation(
    session_id: str,
    canvas_id: Optional[str] = None,
    message: Dict[str, Any] = None
):
    """
    确认用户消息已收到并开始处理
    
    Args:
        session_id: 会话ID
        canvas_id: 画布ID
        message: 用户消息内容
    """
    try:
        await send_generation_status(
            session_id=session_id,
            canvas_id=canvas_id,
            status='started',
            message='收到您的请求，AI正在思考中...',
            progress=0.1,
            data={'user_message': message} if message else None
        )
    except Exception as e:
        logger.error(f"Error sending user message confirmation: {e}")
        traceback.print_exc()


async def send_ai_thinking_status(session_id: str, canvas_id: Optional[str] = None):
    """发送AI思考状态"""
    await send_generation_status(
        session_id=session_id,
        canvas_id=canvas_id,
        status='progress',
        message='AI正在理解您的需求...',
        progress=0.2
    )


async def send_image_generation_status(session_id: str, canvas_id: Optional[str] = None):
    """发送图片生成状态"""
    await send_generation_status(
        session_id=session_id,
        canvas_id=canvas_id,
        status='progress',
        message='正在生成图片，请稍候...',
        progress=0.5
    )


async def send_image_upload_status(session_id: str, canvas_id: Optional[str] = None):
    """发送图片上传状态"""
    await send_generation_status(
        session_id=session_id,
        canvas_id=canvas_id,
        status='progress',
        message='图片生成完成，正在上传到云端...',
        progress=0.8
    )


async def get_image_dimensions(image_url: str) -> Tuple[int, int]:
    """获取图片的真实尺寸"""
    import httpx
    from PIL import Image
    from io import BytesIO
    
    try:
        # 下载图片头部信息获取尺寸
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 只下载图片头部，不下载完整图片
            headers = {"Range": "bytes=0-2047"}  # 前2KB通常足够获取图片尺寸
            response = await client.get(image_url, headers=headers)
            
            if response.status_code in [200, 206]:  # 200 or Partial Content
                # 使用PIL获取图片尺寸
                image_data = BytesIO(response.content)
                with Image.open(image_data) as img:
                    width, height = img.size
                    logger.info(f"🖼️ [WEBSOCKET] 获取到图片真实尺寸: {width}x{height}")
                    return width, height
            else:
                logger.warning(f"⚠️ [WEBSOCKET] 无法获取图片尺寸，HTTP状态: {response.status_code}")
                
    except Exception as e:
        logger.error(f"❌ [WEBSOCKET] 获取图片尺寸失败: {e}")
    
    # 返回默认尺寸
    logger.info(f"🖼️ [WEBSOCKET] 使用默认尺寸: 512x512")
    return 512, 512


async def send_image_to_canvas(session_id: str, canvas_id: Optional[str], image_url: str):
    """发送图片到画布"""
    import re
    import uuid
    
    logger.info(f"🖼️ [WEBSOCKET] 准备发送图片到画布: session_id={session_id}, canvas_id={canvas_id}, image_url={image_url[:100]}...")
    
    # 获取图片真实尺寸
    width, height = await get_image_dimensions(image_url)
    
    # 如果图片太大，按比例缩放到合理尺寸（最大600px）
    max_size = 600
    if width > max_size or height > max_size:
        ratio = min(max_size / width, max_size / height)
        width = int(width * ratio)
        height = int(height * ratio)
        logger.info(f"🖼️ [WEBSOCKET] 图片缩放到: {width}x{height}")
    
    # 创建画布图片元素数据
    element_id = str(uuid.uuid4())
    
    # 使用真实尺寸的图片元素数据结构
    image_element = {
        "id": element_id,
        "type": "image",
        "x": 100,  # 默认位置
        "y": 100,
        "width": width,   # 使用真实宽度
        "height": height, # 使用真实高度
        "angle": 0,
        "strokeColor": "transparent",
        "backgroundColor": "transparent",
        "fillStyle": "solid",
        "strokeWidth": 0,
        "roughness": 0,
        "opacity": 100,
        "fileId": element_id,
        "scale": [1, 1]
    }
    
    # 文件数据
    file_data = {
        "mimeType": "image/png",
        "id": element_id,
        "dataURL": image_url,
        "created": int(time.time() * 1000),
        "lastRetrieved": int(time.time() * 1000)
    }
    
    # 发送 image_generated 事件
    image_event = {
        'type': 'image_generated',
        'session_id': session_id,
        'canvas_id': canvas_id,
        'element': image_element,
        'file': file_data,
        'image_url': image_url
    }
    
    logger.info(f"🖼️ [WEBSOCKET] 发送image_generated事件，尺寸: {width}x{height}")
    await send_to_websocket(session_id, image_event)


def extract_image_urls_from_content(content: str) -> List[str]:
    """从AI响应内容中提取图片URL - 支持HTML注释格式和标准markdown格式"""
    import re
    
    image_urls = []
    
    # 🔧 [CHAT_FIX] 优先匹配HTML注释中的图片（新格式）
    # 格式：<!-- IMAGE_GENERATED: ![image_id: filename](url) -->
    image_comment_pattern = r'<!--\s*IMAGE_GENERATED:\s*!\[.*?\]\((https?://[^)]+)\)\s*-->'
    image_comment_matches = re.findall(image_comment_pattern, content)
    
    logger.info(f"🖼️ [WEBSOCKET_DEBUG] 从HTML注释中提取到 {len(image_comment_matches)} 个图片URL")
    for url in image_comment_matches:
        logger.info(f"🖼️ [WEBSOCKET_DEBUG] HTML注释图片URL: {url}")
        image_urls.append(url)
    
    # 🔧 [CHAT_FIX] 匹配HTML注释中的视频（新格式）
    # 格式：<!-- VIDEO_GENERATED: ![video_id: filename](url) -->
    video_comment_pattern = r'<!--\s*VIDEO_GENERATED:\s*!\[.*?\]\((https?://[^)]+)\)\s*-->'
    video_comment_matches = re.findall(video_comment_pattern, content)
    
    logger.info(f"🎬 [WEBSOCKET_DEBUG] 从HTML注释中提取到 {len(video_comment_matches)} 个视频URL")
    for url in video_comment_matches:
        logger.info(f"🎬 [WEBSOCKET_DEBUG] HTML注释视频URL: {url}")
        image_urls.append(url)  # 视频也加入到image_urls中，统一处理
    
    # 🔧 [CHAT_FIX] 兼容标准markdown格式（旧格式）
    # 匹配 ![任意内容](URL) 格式的图片
    markdown_pattern = r'!\[.*?\]\((https?://[^)]+)\)'
    markdown_matches = re.findall(markdown_pattern, content)
    
    logger.info(f"🖼️ [WEBSOCKET_DEBUG] 从标准markdown中提取到 {len(markdown_matches)} 个图片URL")
    for url in markdown_matches:
        # 避免重复添加（如果HTML注释中已经有了）
        if url not in image_urls:
            # 确保URL指向图片文件
            if any(url.lower().endswith(ext) for ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']) or 'image' in url.lower():
                logger.info(f"🖼️ [WEBSOCKET_DEBUG] 标准markdown图片URL: {url}")
                image_urls.append(url)
    
    logger.info(f"🖼️ [WEBSOCKET_DEBUG] 总共提取到 {len(image_urls)} 个图片URL")
    return image_urls


async def process_and_send_images_to_canvas(session_id: str, canvas_id: Optional[str], ai_response_content: str):
    """处理AI响应并发送图片到画布"""
    if not ai_response_content:
        return
    
    image_urls = extract_image_urls_from_content(ai_response_content)
    
    if image_urls:
        logger.info(f"🖼️ [WEBSOCKET] 从AI响应中提取到 {len(image_urls)} 张图片")
        for i, image_url in enumerate(image_urls):
            logger.info(f"🖼️ [WEBSOCKET] 发送第 {i+1} 张图片到画布: {image_url[:100]}...")
            await send_image_to_canvas(session_id, canvas_id, image_url)
    else:
        logger.info(f"🖼️ [WEBSOCKET] AI响应中未找到图片URL")


async def send_generation_complete(
    session_id: str, 
    canvas_id: Optional[str] = None,
    result_data: Optional[Dict[str, Any]] = None
):
    """发送生成完成状态"""
    await send_generation_status(
        session_id=session_id,
        canvas_id=canvas_id,
        status='complete',
        message='✨ 图片生成完成！',
        progress=1.0,
        data=result_data
    )
