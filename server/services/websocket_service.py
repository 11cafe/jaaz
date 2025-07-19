# services/websocket_service.py
from services.websocket_state import sio, get_all_socket_ids
import traceback
from typing import Any, Dict


async def broadcast_session_update(session_id: str, canvas_id: str | None, event: Dict[str, Any]):
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
            print(f"Error broadcasting session update for {session_id}: {e}")
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
        print("Broadcasted init_done to all clients")
    except Exception as e:
        print(f"Error broadcasting init_done: {e}")
        traceback.print_exc()
