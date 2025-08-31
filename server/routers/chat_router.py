#server/routers/chat_router.py
from fastapi import APIRouter, Request
from services.chat_service import handle_chat
from services.magic_service import handle_magic
from services.stream_service import get_stream_task
from typing import Dict

router = APIRouter(prefix="/api")

@router.post("/chat")
async def chat(request: Request):
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
async def magic(request: Request):
    """
    Endpoint to handle magic generation requests.

    Receives a JSON payload from the client, passes it to the magic handler,
    and returns a success status.

    Request body:
        JSON object containing magic generation data.

    Response:
        {"status": "done"}
    """
    data = await request.json()
    print(f"magic data: {data}")
    await handle_magic(data)
    return {"status": "done"}

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
