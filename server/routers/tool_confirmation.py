from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from services.websocket_service import send_to_websocket
from services.tool_confirmation_manager import tool_confirmation_manager

router = APIRouter(prefix="/api")

class ToolConfirmationRequest(BaseModel):
    session_id: str
    tool_call_id: str
    confirmed: bool

@router.post("/tool_confirmation")
async def handle_tool_confirmation(request: ToolConfirmationRequest):
    """处理工具调用确认"""
    try:
        if request.confirmed:
            # 确认工具调用
            success = tool_confirmation_manager.confirm_tool(
                request.tool_call_id)
            if success:
                await send_to_websocket(request.session_id, {
                    'type': 'tool_call_confirmed',
                    'id': request.tool_call_id
                })
            else:
                raise HTTPException(
                    status_code=404, detail="Tool call not found or already processed")
        else:
            # 取消工具调用
            success = tool_confirmation_manager.cancel_confirmation(
                request.tool_call_id)
            if success:
                await send_to_websocket(request.session_id, {
                    'type': 'tool_call_cancelled',
                    'id': request.tool_call_id
                })
            else:
                raise HTTPException(
                    status_code=404, detail="Tool call not found or already processed")

        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
