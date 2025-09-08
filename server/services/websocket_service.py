# services/websocket_service.py
from services.websocket_state import sio, get_all_socket_ids
import traceback
import time
from typing import Any, Dict, Literal, Optional
from log import get_logger

logger = get_logger(__name__)


async def broadcast_session_update(session_id: str, canvas_id: str | None, event: Dict[str, Any]):
    # Validate session_id to prevent empty session_id from being broadcast
    if not session_id or session_id.strip() == '':
        logger.warn(f"[warn] Attempted to broadcast with empty session_id, event: {event}")
        return
    
    socket_ids = get_all_socket_ids()
    if socket_ids:
        try:
            for socket_id in socket_ids:
                await sio.emit('session_update', {
                    'canvas_id': canvas_id,
                    'session_id': session_id,
                    **event
                }, room=socket_id)
        except Exception as e:
            logger.error(f"Error broadcasting session update for {session_id}: {e}")
            traceback.print_exc()

# compatible with legacy codes
# TODO: All Broadcast should have a canvas_id


async def send_to_websocket(session_id: str, event: Dict[str, Any]):
    await broadcast_session_update(session_id, None, event)


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
