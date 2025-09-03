# services/websocket_state.py
import socketio
from typing import Dict
from log import get_logger

logger = get_logger(__name__)

sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi'
)

active_connections: Dict[str, dict] = {}

def add_connection(socket_id: str, user_info: dict = None):
    active_connections[socket_id] = user_info or {}
    logger.info(f"New connection added: {socket_id}, total connections: {len(active_connections)}")

def remove_connection(socket_id: str):
    if socket_id in active_connections:
        del active_connections[socket_id]
        logger.info(f"Connection removed: {socket_id}, total connections: {len(active_connections)}")

def get_all_socket_ids():
    return list(active_connections.keys())

def get_connection_count():
    return len(active_connections)
