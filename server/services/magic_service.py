# services/magic_service.py

# Import necessary modules
import asyncio
import json
from typing import Dict, Any, List

# Import service modules
from services.db_service import db_service
from services.OpenAIAgents_service import create_magic_response, create_jaaz_response
from services.websocket_service import send_to_websocket  # type: ignore
from services.stream_service import add_stream_task, remove_stream_task
from models.config_model import ModelInfo


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
    text_model: ModelInfo = data.get('text_model', {})
    tool_list: List[ModelInfo] = data.get('tool_list', [])

    print('✨ magic_service 接收到数据:', {
        'session_id': session_id,
        'canvas_id': canvas_id,
        'messages_count': len(messages),
        'text_model': text_model,
        'tool_list': tool_list
    })

    # If there is only one message, create a new magic session
    if len(messages) == 1:
        # create new session
        prompt = messages[0].get('content', '')
        await db_service.create_chat_session(session_id, text_model.get('model'), text_model.get('provider'), canvas_id, (prompt[:200] if isinstance(prompt, str) else ''))

    # Save user message to database
    if len(messages) > 0:
        await db_service.create_message(session_id, messages[-1].get('role', 'user'), json.dumps(messages[-1]))

    # Create and start magic generation task
    task = asyncio.create_task(_process_magic_generation(text_model.get('provider'), messages, session_id, canvas_id))

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
        await send_to_websocket(session_id, {
            'type': 'done'
        })

    print('✨ magic_service 处理完成')


async def _process_magic_generation(
    provider: str,
    messages: List[Dict[str, Any]],
    session_id: str,
    canvas_id: str,
) -> None:
    """
    Process magic generation in a separate async task.

    Args:
        messages: List of messages
        session_id: Session ID
        canvas_id: Canvas ID
    """
    # Create AI response using OpenAI API
    if provider == 'jaaz':
        ai_response = await create_jaaz_response(messages, session_id, canvas_id)
    else:
        ai_response = await create_magic_response(messages, session_id, canvas_id)

    # Save AI response to database
    await db_service.create_message(session_id, 'assistant', json.dumps(ai_response))

    # Send messages to frontend immediately
    all_messages = messages + [ai_response]
    await send_to_websocket(session_id, {
        'type': 'all_messages',
        'messages': all_messages
    })

