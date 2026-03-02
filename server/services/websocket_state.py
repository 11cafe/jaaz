# services/websocket_state.py
import socketio
from typing import Dict, List, Optional
from log import get_logger

logger = get_logger(__name__)

sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi'
)

# 存储连接信息：socket_id -> {user_info, session_id, canvas_id}
active_connections: Dict[str, dict] = {}

def add_connection(socket_id: str, user_info: dict = None):
    active_connections[socket_id] = user_info or {}
    logger.info(f"New connection added: {socket_id}, total connections: {len(active_connections)}")

def remove_connection(socket_id: str):
    if socket_id in active_connections:
        connection_info = active_connections[socket_id]
        del active_connections[socket_id]
        logger.info(f"Connection removed: {socket_id}, session_id: {connection_info.get('session_id')}, total connections: {len(active_connections)}")

def update_connection_session(socket_id: str, session_id: str, canvas_id: str = None):
    """更新连接的session信息"""
    if socket_id in active_connections:
        active_connections[socket_id]['session_id'] = session_id
        if canvas_id:
            active_connections[socket_id]['canvas_id'] = canvas_id
        logger.info(f"Updated connection session: {socket_id} -> session_id: {session_id}, canvas_id: {canvas_id}")

def get_sockets_for_session(session_id: str) -> List[str]:
    """获取指定session的所有socket连接"""
    if not session_id:
        logger.warning(f"🔍 [CONNECTION_DEBUG] get_sockets_for_session called with empty session_id")
        return []
    
    logger.info(f"🔍 [CONNECTION_DEBUG] 查找session {session_id} 的socket连接...")
    logger.info(f"🔍 [CONNECTION_DEBUG] 当前所有连接状态:")
    
    session_sockets = []
    for socket_id, connection_info in active_connections.items():
        stored_session = connection_info.get('session_id')
        logger.info(f"🔍 [CONNECTION_DEBUG]   Socket {socket_id}: session_id={stored_session}, canvas_id={connection_info.get('canvas_id')}")
        
        if stored_session == session_id:
            session_sockets.append(socket_id)
            logger.info(f"✅ [CONNECTION_DEBUG]   匹配! 添加socket {socket_id}")
    
    logger.info(f"🔍 [CONNECTION_DEBUG] 查找结果: Found {len(session_sockets)} sockets for session {session_id}: {session_sockets}")
    
    if not session_sockets:
        logger.warning(f"⚠️ [CONNECTION_DEBUG] 没有找到session {session_id} 的注册socket!")
        logger.warning(f"⚠️ [CONNECTION_DEBUG] 这可能是因为前端没有调用register_session事件")
    
    return session_sockets

def get_all_socket_ids():
    """获取所有socket ID（保留向后兼容）"""
    return list(active_connections.keys())

def get_connection_count():
    return len(active_connections)

def get_session_count():
    """获取唯一session数量"""
    sessions = set()
    for connection_info in active_connections.values():
        session_id = connection_info.get('session_id')
        if session_id:
            sessions.add(session_id)
    return len(sessions)
