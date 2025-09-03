# routers/websocket_router.py
from services.websocket_state import sio, add_connection, remove_connection
from log import get_logger

logger = get_logger(__name__)

@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Client {sid} connected")
    
    user_info = auth or {}
    add_connection(sid, user_info)
    
    await sio.emit('connected', {'status': 'connected'}, room=sid)

@sio.event
async def disconnect(sid):
    logger.info(f"Client {sid} disconnected")
    remove_connection(sid)

@sio.event
async def ping(sid, data):
    await sio.emit('pong', data, room=sid)
