#server/routers/chat_router.py
from fastapi import APIRouter, Request, Depends, HTTPException
from services.new_chat import handle_chat
from services.magic_service import handle_magic
from services.stream_service import get_stream_task
from utils.auth_utils import get_current_user_optional, CurrentUser
from typing import Dict, Optional
from log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api")

@router.post("/chat")
async def chat(request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    """
    Endpoint to handle chat requests.

    Receives a JSON payload from the client, passes it to the chat handler,
    and returns a success status.

    Request body:
        JSON object containing chat data.

    Response:
        {"status": "done"}
    """
    data = await request.json()
    
    # 🔍 添加用户信息到请求数据中
    if current_user:
        data['user_info'] = {
            'id': current_user.id,
            'uuid': current_user.uuid,
            'email': current_user.email,
            'nickname': current_user.nickname
        }
    
    await handle_chat(data)
    return {"status": "done"}

@router.post("/cancel/{session_id}")
async def cancel_chat(session_id: str):
    """
    Endpoint to cancel an ongoing stream task for a given session_id.

    If the task exists and is not yet completed, it will be cancelled.

    Path parameter:
        session_id (str): The ID of the session whose task should be cancelled.

    Response:
        {"status": "cancelled"} if the task was cancelled.
        {"status": "not_found_or_done"} if no such task exists or it is already done.
    """
    task = get_stream_task(session_id)
    if task and not task.done():
        task.cancel()
        return {"status": "cancelled"}
    return {"status": "not_found_or_done"}

@router.post("/magic")
async def magic(request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    """
    Endpoint to handle magic generation requests.

    Receives a JSON payload from the client, passes it to the magic handler,
    and returns a success status.

    Request body:
        JSON object containing magic generation data.

    Response:
        {"status": "done"}
    """
    try:
        data = await request.json()
        
        # 🔍 添加用户信息到请求数据中
        if current_user:
            data['user_info'] = {
                'id': current_user.id,
                'uuid': current_user.uuid,
                'email': current_user.email,
                'nickname': current_user.nickname
            }
        await handle_magic(data)
        return {"status": "done"}
        
    except Exception as e:
        logger.error(f"Magic generation error: {e}")
        # 检查是否是文件过大错误
        error_msg = str(e).lower()
        if "413" in error_msg or "too large" in error_msg or "entity too large" in error_msg:
            raise HTTPException(
                status_code=413,
                detail="Image file is too large. Please use an image smaller than 50MB."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Magic generation failed: {str(e)}"
            )

@router.post("/magic/cancel/{session_id}")
async def cancel_magic(session_id: str) -> Dict[str, str]:
    """
    Endpoint to cancel an ongoing magic generation task for a given session_id.

    If the task exists and is not yet completed, it will be cancelled.

    Path parameter:
        session_id (str): The ID of the session whose task should be cancelled.

    Response:
        {"status": "cancelled"} if the task was cancelled.
        {"status": "not_found_or_done"} if no such task exists or it is already done.
    """
    task = get_stream_task(session_id)
    if task and not task.done():
        task.cancel()
        return {"status": "cancelled"}
    return {"status": "not_found_or_done"}
