import sqlite3
import json
import os
import uuid
from typing import List, Dict, Any, Optional
import aiosqlite
from .config_service import USER_DATA_DIR
from .migrations.manager import MigrationManager, CURRENT_VERSION
from log import get_logger

logger = get_logger(__name__)

DB_PATH = os.path.join(USER_DATA_DIR, "localmanus.db")

class DatabaseService:
    def __init__(self):
        self.db_path = DB_PATH
        self._ensure_db_directory()
        self._migration_manager = MigrationManager()
        self._init_db()

    def _ensure_db_directory(self):
        """Ensure the database directory exists"""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)

    def _init_db(self):
        """Initialize the database with the current schema"""
        with sqlite3.connect(self.db_path) as conn:
            # Create version table if it doesn't exist
            conn.execute("""
                CREATE TABLE IF NOT EXISTS db_version (
                    version INTEGER PRIMARY KEY
                )
            """)
            
            # Get current version
            cursor = conn.execute("SELECT version FROM db_version")
            current_version = cursor.fetchone()
            logger.info(f"local db version {current_version} latest version {CURRENT_VERSION}")
            
            if current_version is None:
                # First time setup - start from version 0
                conn.execute("INSERT INTO db_version (version) VALUES (0)")
                self._migration_manager.migrate(conn, 0, CURRENT_VERSION)
            elif current_version[0] < CURRENT_VERSION:
                logger.info(f'Migrating database from version {current_version[0]} to {CURRENT_VERSION}')
                # Need to migrate
                self._migration_manager.migrate(conn, current_version[0], CURRENT_VERSION)

    async def create_canvas(self, id: str, name: str, user_uuid: str = None, user_email: Optional[str] = None):
        """Create a new canvas with user UUID"""
        email = user_email if user_email is not None else 'anonymous'
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO tb_canvases (id, name, uuid, email)
                VALUES (?, ?, ?, ?)
            """, (id, name, user_uuid, email))
            await db.commit()

    async def list_canvases(self, user_uuid: str = None, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get canvases filtered by user email (preferred) or UUID (fallback)"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            
            # 优先使用email查询，因为email是用户的真正唯一标识，跨设备一致
            if user_email and user_email != 'anonymous':
                logger.info(f"Listing canvases for user email: {user_email}")
                cursor = await db.execute("""
                    SELECT id, name, description, thumbnail, created_at, updated_at, email, uuid
                    FROM tb_canvases
                    WHERE email = ?
                    ORDER BY updated_at DESC
                """, (user_email,))
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
            
            # 如果没有提供user_uuid，使用匿名用户的UUID
            if user_uuid is None:
                anonymous_user = await self.get_user_by_id(1)
                user_uuid = anonymous_user['uuid'] if anonymous_user else None
                
            logger.info(f"Listing canvases for user UUID: {user_uuid} (fallback)")
            cursor = await db.execute("""
                SELECT id, name, description, thumbnail, created_at, updated_at, email, uuid
                FROM tb_canvases
                WHERE uuid = ?
                ORDER BY updated_at DESC
            """, (user_uuid,))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def create_chat_session(self, id: str, model: str, provider: str, canvas_id: str, user_uuid: Optional[str] = None, title: Optional[str] = None):
        """Save a new chat session"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            # 检查会话是否已存在，如果存在就不重复创建
            cursor = await db.execute("SELECT id FROM tb_chat_sessions WHERE id = ?", (id,))
            existing_session = await cursor.fetchone()
            
            if existing_session:
                logger.info(f"Chat session {id} already exists, skipping creation")
                return
                
            await db.execute("""
                INSERT INTO tb_chat_sessions (id, model, provider, canvas_id, uuid, title)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (id, model, provider, canvas_id, user_uuid, title))
            await db.commit()
            logger.info(f"Created new chat session: {id}")

    async def create_message(self, session_id: str, role: str, message: str, user_uuid: Optional[str] = None):
        """Save a chat message"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO tb_chat_messages (session_id, role, message, uuid)
                VALUES (?, ?, ?, ?)
            """, (session_id, role, message, user_uuid))
            await db.commit()

    async def get_chat_history(self, session_id: str, user_uuid: str = None) -> List[Dict[str, Any]]:
        """Get chat history for a session"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT role, message, id
                FROM tb_chat_messages
                WHERE session_id = ? AND uuid = ?
                ORDER BY id ASC
            """, (session_id, user_uuid))
            rows = await cursor.fetchall()
            
            messages = []
            for row in rows:
                row_dict = dict(row)
                if row_dict['message']:
                    try:
                        msg = json.loads(row_dict['message'])
                        messages.append(msg)
                    except:
                        pass
                
            return messages

    async def list_sessions(self, canvas_id: str = None, user_uuid: str = None, user_email: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all chat sessions for a user"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            if canvas_id:
                cursor = await db.execute("""
                    SELECT id, title, model, provider, created_at, updated_at, canvas_id, uuid
                    FROM tb_chat_sessions
                    WHERE canvas_id = ? AND uuid = ?
                    ORDER BY updated_at DESC
                """, (canvas_id, user_uuid))
            else:
                cursor = await db.execute("""
                    SELECT id, title, model, provider, created_at, updated_at, canvas_id, uuid
                    FROM tb_chat_sessions
                    WHERE uuid = ?
                    ORDER BY updated_at DESC
                """, (user_uuid,))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def save_canvas_data(self, id: str, data: str, user_uuid: str = None, thumbnail: Optional[str] = None, user_email: Optional[str] = None):
        """Save canvas data with user email (preferred) or UUID verification"""
        async with aiosqlite.connect(self.db_path) as db:
            # 优先使用email进行验证
            if user_email and user_email != 'anonymous':
                await db.execute("""
                    UPDATE tb_canvases 
                    SET data = ?, thumbnail = ?, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ? AND email = ?
                """, (data, thumbnail, id, user_email))
                await db.commit()
                return
            
            # 如果没有提供user_uuid，使用匿名用户的UUID
            if user_uuid is None:
                anonymous_user = await self.get_user_by_id(1)
                user_uuid = anonymous_user['uuid'] if anonymous_user else None
                
            await db.execute("""
                UPDATE tb_canvases 
                SET data = ?, thumbnail = ?, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ? AND uuid = ?
            """, (data, thumbnail, id, user_uuid))
            await db.commit()

    async def get_canvas_data(self, id: str, user_uuid: str = None, user_email: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get canvas data with user email (preferred) or UUID verification"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            
            # 优先使用email查询
            if user_email and user_email != 'anonymous':
                cursor = await db.execute("""
                    SELECT data, name, email, uuid
                    FROM tb_canvases
                    WHERE id = ? AND email = ?
                """, (id, user_email))
                row = await cursor.fetchone()
                if row:
                    sessions = await self.list_sessions(id, user_uuid, user_email)
                    return {
                        'data': json.loads(row['data']) if row['data'] else {},
                        'name': row['name'],
                        'sessions': sessions
                    }
                return None
            
            # 如果没有提供user_uuid，使用匿名用户的UUID
            if user_uuid is None:
                anonymous_user = await self.get_user_by_id(1)
                user_uuid = anonymous_user['uuid'] if anonymous_user else None
                
            cursor = await db.execute("""
                SELECT data, name, email, uuid
                FROM tb_canvases
                WHERE id = ? AND uuid = ?
            """, (id, user_uuid))
            row = await cursor.fetchone()

            if row:
                sessions = await self.list_sessions(id, user_uuid, user_email)
                return {
                    'data': json.loads(row['data']) if row['data'] else {},
                    'name': row['name'],
                    'sessions': sessions
                }
            return None

    async def delete_canvas(self, id: str, user_uuid: str = None, user_email: Optional[str] = None):
        """Delete canvas with user email (preferred) or UUID verification"""
        async with aiosqlite.connect(self.db_path) as db:
            # 优先使用email进行验证
            if user_email and user_email != 'anonymous':
                await db.execute("DELETE FROM tb_canvases WHERE id = ? AND email = ?", (id, user_email))
                await db.commit()
                return
            
            # 如果没有提供user_uuid，使用匿名用户的UUID
            if user_uuid is None:
                anonymous_user = await self.get_user_by_id(1)
                user_uuid = anonymous_user['uuid'] if anonymous_user else None
                
            await db.execute("DELETE FROM tb_canvases WHERE id = ? AND uuid = ?", (id, user_uuid))
            await db.commit()

    async def rename_canvas(self, id: str, name: str, user_uuid: str = None, user_email: Optional[str] = None):
        """Rename canvas with user email (preferred) or UUID verification"""
        async with aiosqlite.connect(self.db_path) as db:
            # 优先使用email进行验证
            if user_email and user_email != 'anonymous':
                await db.execute("UPDATE tb_canvases SET name = ? WHERE id = ? AND email = ?", (name, id, user_email))
                await db.commit()
                return
            
            # 如果没有提供user_uuid，使用匿名用户的UUID
            if user_uuid is None:
                anonymous_user = await self.get_user_by_id(1)
                user_uuid = anonymous_user['uuid'] if anonymous_user else None
                
            await db.execute("UPDATE tb_canvases SET name = ? WHERE id = ? AND uuid = ?", (name, id, user_uuid))
            await db.commit()

    async def create_comfy_workflow(self, name: str, api_json: str, description: str, inputs: str, user_uuid: str = None, outputs: str = None):
        """Create a new comfy workflow"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO tb_comfy_workflows (name, api_json, description, inputs, outputs, uuid)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (name, api_json, description, inputs, outputs, user_uuid))
            await db.commit()

    async def list_comfy_workflows(self, user_uuid: str = None) -> List[Dict[str, Any]]:
        """List all comfy workflows for a user"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT id, name, description, api_json, inputs, outputs, uuid 
                FROM tb_comfy_workflows 
                WHERE uuid = ?
                ORDER BY id DESC
            """, (user_uuid,))
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]

    async def delete_comfy_workflow(self, id: int, user_uuid: str = None):
        """Delete a comfy workflow"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("DELETE FROM tb_comfy_workflows WHERE id = ? AND uuid = ?", (id, user_uuid))
            await db.commit()

    async def get_comfy_workflow(self, id: int, user_uuid: str = None):
        """Get comfy workflow dict"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None
            
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute(
                "SELECT api_json FROM tb_comfy_workflows WHERE id = ? AND uuid = ?", (id, user_uuid)
            )
            row = await cursor.fetchone()
        try:
            workflow_json = (
                row["api_json"]
                if isinstance(row["api_json"], dict)
                else json.loads(row["api_json"])
            )
            return workflow_json
        except json.JSONDecodeError as exc:
            raise ValueError(f"Stored workflow api_json is not valid JSON: {exc}")

    # User management methods
    async def create_user(self, email: str, nickname: str, points: int = 0) -> int:
        """Create a new user and return user ID"""
        user_uuid = str(uuid.uuid4())
        async with aiosqlite.connect(self.db_path) as db:
            cursor = await db.execute("""
                INSERT INTO tb_user (email, nickname, points, uuid)
                VALUES (?, ?, ?, ?)
            """, (email, nickname, points, user_uuid))
            await db.commit()
            return cursor.lastrowid

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT id, email, nickname, points, ctime, mtime, uuid
                FROM tb_user
                WHERE email = ?
            """, (email,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_user_by_id(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user by ID"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT id, email, nickname, points, ctime, mtime, uuid
                FROM tb_user
                WHERE id = ?
            """, (user_id,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def get_user_by_uuid(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        """Get user by UUID"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            cursor = await db.execute("""
                SELECT id, email, nickname, points, ctime, mtime, uuid
                FROM tb_user
                WHERE uuid = ?
            """, (user_uuid,))
            row = await cursor.fetchone()
            return dict(row) if row else None

    async def update_user_points(self, user_id: int, points: int):
        """Update user points"""
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                UPDATE tb_user 
                SET points = ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ?
            """, (points, user_id))
            await db.commit()

    async def update_user_info(self, user_id: int, nickname: str = None, email: str = None):
        """Update user information"""
        async with aiosqlite.connect(self.db_path) as db:
            if nickname and email:
                await db.execute("""
                    UPDATE tb_user 
                    SET nickname = ?, email = ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (nickname, email, user_id))
            elif nickname:
                await db.execute("""
                    UPDATE tb_user 
                    SET nickname = ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (nickname, user_id))
            elif email:
                await db.execute("""
                    UPDATE tb_user 
                    SET email = ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (email, user_id))
            await db.commit()

    async def get_or_create_user(self, email: str, username: str, provider: str = "google", 
                                google_id: str = None, image_url: str = None) -> Dict[str, Any]:
        """
        获取用户或创建新用户（用于OAuth登录）
        Returns: {
            "user": user_dict,
            "is_new": boolean,  # 是否是新创建的用户
            "message": str      # 操作信息
        }
        """
        logger.info(f"Getting or creating user for email: {email}")
        
        # 先检查用户是否存在
        existing_user = await self.get_user_by_email(email)
        
        if existing_user:
            logger.info(f"Found existing user: {existing_user['id']}, email: {email}")
            # 更新用户信息（如昵称可能变化）
            if existing_user['nickname'] != username:
                await self.update_user_info(existing_user['id'], nickname=username)
                logger.info(f"Updated nickname for user {existing_user['id']}: {username}")
            
            # 返回现有用户信息
            updated_user = await self.get_user_by_id(existing_user['id'])
            return {
                "user": updated_user,
                "is_new": False,
                "message": f"Welcome back, {username}!"
            }
        else:
            # 创建新用户
            logger.info(f"Creating new user: email={email}, username={username}, provider={provider}")
            user_id = await self.create_user(
                email=email,
                nickname=username,
                points=100  # 新用户赠送100积分
            )
            
            # 获取新创建的用户信息
            new_user = await self.get_user_by_id(user_id)
            logger.info(f"Created new user: {user_id}, email: {email}")
            
            return {
                "user": new_user,
                "is_new": True,
                "message": f"Welcome to the platform, {username}! You've received 100 bonus points."
            }

# Create a singleton instance
db_service = DatabaseService()
