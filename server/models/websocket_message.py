# models/websocket_message.py
from typing import Any, Dict, Literal, Optional
from pydantic import BaseModel


class WebSocketMessage(BaseModel):
    """WebSocket消息模型"""
    type: Literal[
        'generation_started',    # 开始生成
        'generation_progress',   # 生成进度
        'generation_complete',   # 生成完成
        'error',                # 错误
        'all_messages',         # 所有消息
        'user_message_added',   # 用户消息已添加
        'ai_response_started',  # AI开始响应
        'ai_response_complete', # AI响应完成
        'image_upload_started', # 图片上传开始
        'image_upload_complete' # 图片上传完成
    ]
    session_id: str
    canvas_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    progress: Optional[float] = None
    timestamp: Optional[int] = None


class GenerationStatus(BaseModel):
    """生成状态模型"""
    status: Literal['pending', 'processing', 'uploading', 'complete', 'error']
    message: str
    progress: float = 0.0
    estimated_time: Optional[int] = None  # 预估剩余时间（秒）
    current_step: Optional[str] = None
    total_steps: Optional[int] = None
    current_step_index: Optional[int] = None