# routers/websocket_router.py
from services.websocket_state import sio, add_connection, remove_connection, update_connection_session
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

@sio.event
async def register_session(sid, data):
    """注册socket连接的session信息"""
    session_id = data.get('session_id')
    canvas_id = data.get('canvas_id')
    
    if session_id:
        update_connection_session(sid, session_id, canvas_id)
        logger.info(f"Socket {sid} 注册到session {session_id}, canvas {canvas_id}")
        await sio.emit('session_registered', {'session_id': session_id, 'canvas_id': canvas_id}, room=sid)
    else:
        logger.warning(f"Socket {sid} 尝试注册但没有提供session_id")
        await sio.emit('registration_failed', {'error': 'session_id is required'}, room=sid)
