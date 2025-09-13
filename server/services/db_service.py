import sqlite3
import json
import os
import uuid
from typing import List, Dict, Any, Optional
import aiosqlite
from .config_service import USER_DATA_DIR
from .migrations.manager import MigrationManager, CURRENT_VERSION
from utils.cos_image_service import get_cos_image_service
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

    def _convert_thumbnail_to_cos_url(self, thumbnail: str) -> str:
        """
        将 /api/file/ 格式的thumbnail转换为腾讯云直链URL
        使用统一的URL转换工具
        """
        if not thumbnail or not isinstance(thumbnail, str):
            return thumbnail
            
        try:
            # 使用统一的URL转换工具
            from utils.url_converter import convert_to_cos_url
            cos_url = convert_to_cos_url(thumbnail)
            
            if cos_url != thumbnail:
                logger.info(f"✨ 转换thumbnail URL: {thumbnail} -> {cos_url}")
            
            return cos_url
                
        except Exception as e:
            logger.error(f"❌ 转换thumbnail URL失败: {thumbnail}, error: {e}")
            return thumbnail

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
                # 转换thumbnail URL为腾讯云直链
                canvases = []
                for row in rows:
                    canvas = dict(row)
                    if canvas.get('thumbnail'):
                        canvas['thumbnail'] = self._convert_thumbnail_to_cos_url(canvas['thumbnail'])
                    canvases.append(canvas)
                return canvases
            
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
            # 转换thumbnail URL为腾讯云直链
            canvases = []
            for row in rows:
                canvas = dict(row)
                if canvas.get('thumbnail'):
                    canvas['thumbnail'] = self._convert_thumbnail_to_cos_url(canvas['thumbnail'])
                canvases.append(canvas)
            return canvases

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

    async def rename_session(self, session_id: str, title: str, user_uuid: str = None, user_email: Optional[str] = None):
        """Rename a chat session with user verification"""
        # 如果没有提供user_uuid，使用匿名用户的UUID
        if user_uuid is None:
            anonymous_user = await self.get_user_by_id(1)
            user_uuid = anonymous_user['uuid'] if anonymous_user else None

        async with aiosqlite.connect(self.db_path) as db:
            # 更新session的title，同时验证用户权限
            await db.execute("""
                UPDATE tb_chat_sessions
                SET title = ?, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ? AND uuid = ?
            """, (title, session_id, user_uuid))
            await db.commit()

            # 验证更新是否成功
            cursor = await db.execute("""
                SELECT id FROM tb_chat_sessions WHERE id = ? AND uuid = ?
            """, (session_id, user_uuid))
            row = await cursor.fetchone()

            if not row:
                raise ValueError(f"Session {session_id} not found or access denied")

            logger.info(f"Session {session_id} renamed to '{title}' by user {user_uuid}")

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
                SELECT id, email, nickname, points, ctime, mtime, uuid, level
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
                SELECT id, email, nickname, points, ctime, mtime, uuid, level, subscription_id, order_id
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
                SELECT id, email, nickname, points, ctime, mtime, uuid, level, subscription_id, order_id
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

    async def update_user_level(self, user_id: int, level: str) -> bool:
        """Update user subscription level"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    UPDATE tb_user 
                    SET level = ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (level, user_id))
                await db.commit()
                logger.info(f"Updated user {user_id} level to {level}")
                return True
        except Exception as e:
            logger.error(f"Error updating user level for user {user_id}: {e}")
            return False

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
    
    # =================== 邀请系统相关方法 ===================
    
    async def create_invite_code(self, user_id: int, user_uuid: str, code: str) -> bool:
        """为用户创建邀请码"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    INSERT INTO tb_invite_codes (user_id, user_uuid, code)
                    VALUES (?, ?, ?)
                """, (user_id, user_uuid, code))
                await db.commit()
                logger.info(f"Created invite code {code} for user {user_id}")
                return True
        except Exception as e:
            logger.error(f"Error creating invite code for user {user_id}: {e}")
            return False
    
    async def get_invite_code_by_user(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        """获取用户的邀请码信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, code, used_count, max_uses, is_active, created_at, updated_at
                    FROM tb_invite_codes
                    WHERE user_uuid = ? AND is_active = 1
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (user_uuid,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting invite code for user {user_uuid}: {e}")
            return None
    
    async def get_invite_code_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """根据邀请码获取邀请码信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT ic.id, ic.user_id, ic.user_uuid, ic.code, ic.used_count, 
                           ic.max_uses, ic.is_active, ic.created_at, ic.updated_at,
                           u.email as inviter_email, u.nickname as inviter_nickname
                    FROM tb_invite_codes ic
                    LEFT JOIN tb_user u ON ic.user_uuid = u.uuid
                    WHERE ic.code = ? AND ic.is_active = 1
                """, (code,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting invite code {code}: {e}")
            return None
    
    async def update_invite_code_usage(self, code: str) -> bool:
        """更新邀请码使用次数"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    UPDATE tb_invite_codes 
                    SET used_count = used_count + 1,
                        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE code = ?
                """, (code,))
                await db.commit()
                return True
        except Exception as e:
            logger.error(f"Error updating invite code usage {code}: {e}")
            return False
    
    async def create_invitation_record(self, inviter_id: int, inviter_uuid: str, 
                                     invite_code: str, invitee_email: str,
                                     registration_ip: str = None, 
                                     registration_user_agent: str = None,
                                     device_fingerprint: str = None) -> int:
        """创建邀请记录"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute("""
                    INSERT INTO tb_invitations 
                    (inviter_id, inviter_uuid, invite_code, invitee_email, 
                     registration_ip, registration_user_agent, device_fingerprint, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
                """, (inviter_id, inviter_uuid, invite_code, invitee_email,
                      registration_ip, registration_user_agent, device_fingerprint))
                await db.commit()
                invitation_id = cursor.lastrowid
                logger.info(f"Created invitation record {invitation_id} for {invitee_email}")
                return invitation_id
        except Exception as e:
            logger.error(f"Error creating invitation record: {e}")
            return 0
    
    async def complete_invitation(self, invitation_id: int, invitee_id: int, 
                                invitee_uuid: str, inviter_points: int, 
                                invitee_points: int) -> bool:
        """完成邀请，更新邀请记录状态和积分"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    UPDATE tb_invitations 
                    SET invitee_id = ?, invitee_uuid = ?, status = 'completed',
                        inviter_points_awarded = ?, invitee_points_awarded = ?,
                        completed_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (invitee_id, invitee_uuid, inviter_points, invitee_points, invitation_id))
                await db.commit()
                logger.info(f"Completed invitation {invitation_id}")
                return True
        except Exception as e:
            logger.error(f"Error completing invitation {invitation_id}: {e}")
            return False
    
    async def get_invitation_stats(self, user_uuid: str) -> Dict[str, Any]:
        """获取用户邀请统计信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                
                # 获取邀请统计
                cursor = await db.execute("""
                    SELECT 
                        COUNT(*) as total_invitations,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_invitations,
                        SUM(CASE WHEN status = 'completed' THEN inviter_points_awarded ELSE 0 END) as total_points_earned,
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_invitations
                    FROM tb_invitations
                    WHERE inviter_uuid = ?
                """, (user_uuid,))
                
                stats_row = await cursor.fetchone()
                stats = dict(stats_row) if stats_row else {}
                
                # 获取邀请码信息
                invite_code_info = await self.get_invite_code_by_user(user_uuid)
                
                return {
                    'invite_code': invite_code_info['code'] if invite_code_info else None,
                    'used_count': invite_code_info['used_count'] if invite_code_info else 0,
                    'max_uses': invite_code_info['max_uses'] if invite_code_info else 500,
                    'remaining_uses': (invite_code_info['max_uses'] - invite_code_info['used_count']) if invite_code_info else 500,
                    'total_invitations': stats.get('total_invitations', 0),
                    'successful_invitations': stats.get('successful_invitations', 0),
                    'total_points_earned': stats.get('total_points_earned', 0),
                    'pending_invitations': stats.get('pending_invitations', 0)
                }
                
        except Exception as e:
            logger.error(f"Error getting invitation stats for user {user_uuid}: {e}")
            return {}
    
    async def get_invitation_history(self, user_uuid: str, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        """获取用户邀请历史记录"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT i.id, i.invitee_email, i.status, i.inviter_points_awarded,
                           i.created_at, i.completed_at, u.nickname as invitee_nickname
                    FROM tb_invitations i
                    LEFT JOIN tb_user u ON i.invitee_uuid = u.uuid
                    WHERE i.inviter_uuid = ?
                    ORDER BY i.created_at DESC
                    LIMIT ? OFFSET ?
                """, (user_uuid, limit, offset))
                
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting invitation history for user {user_uuid}: {e}")
            return []
    
    async def check_anti_spam_limits(self, registration_ip: str, device_fingerprint: str) -> Dict[str, Any]:
        """检查防刷限制"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 检查同一IP在24小时内的注册次数
                cursor = await db.execute("""
                    SELECT COUNT(*) as ip_count
                    FROM tb_invitations
                    WHERE registration_ip = ? 
                    AND created_at > datetime('now', '-24 hours')
                """, (registration_ip,))
                
                ip_count = (await cursor.fetchone())[0]
                
                # 检查同一设备指纹的注册次数
                cursor = await db.execute("""
                    SELECT COUNT(*) as device_count
                    FROM tb_invitations
                    WHERE device_fingerprint = ? 
                    AND device_fingerprint IS NOT NULL
                    AND device_fingerprint != ''
                """, (device_fingerprint,))
                
                device_count = (await cursor.fetchone())[0]
                
                return {
                    'ip_count_24h': ip_count,
                    'device_count_total': device_count,
                    'ip_limit_exceeded': ip_count >= 3,  # 同一IP 24小时内最多3次
                    'device_limit_exceeded': device_count >= 1 and device_fingerprint  # 同一设备最多1次
                }
                
        except Exception as e:
            logger.error(f"Error checking anti-spam limits: {e}")
            return {
                'ip_count_24h': 0,
                'device_count_total': 0,
                'ip_limit_exceeded': False,
                'device_limit_exceeded': False
            }
    
    # =================== 支付系统相关方法 ===================
    
    async def get_product_by_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """根据产品ID获取产品信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, product_id, name, level, points, price_cents, description, is_active
                    FROM tb_products
                    WHERE product_id = ? AND is_active = 1
                """, (product_id,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting product {product_id}: {e}")
            return None
    
    async def list_products(self) -> List[Dict[str, Any]]:
        """获取所有可用产品列表"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, product_id, name, level, points, price_cents, description
                    FROM tb_products
                    WHERE is_active = 1
                    ORDER BY level, price_cents
                """)
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error listing products: {e}")
            return []
    
    async def get_product_by_level(self, level: str) -> Optional[Dict[str, Any]]:
        """根据level获取产品信息，包括sku字段"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, product_id, name, level, points, price_cents, description, sku
                    FROM tb_products
                    WHERE level = ? AND is_active = 1
                    LIMIT 1
                """, (level,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting product by level {level}: {e}")
            return None
    
    async def get_product_by_sku(self, sku: str) -> Optional[Dict[str, Any]]:
        """根据sku获取产品信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, product_id, name, level, points, price_cents, description, sku
                    FROM tb_products
                    WHERE sku = ? AND is_active = 1
                    LIMIT 1
                """, (sku,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting product by sku {sku}: {e}")
            return None
    
    async def create_order(self, user_uuid: str, product_id: str, price_cents: int = 0) -> int:
        """创建新订单"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute("""
                    INSERT INTO tb_orders (user_uuid, product_id, price_cents, status)
                    VALUES (?, ?, ?, 'pending')
                """, (user_uuid, product_id, price_cents))
                await db.commit()
                order_id = cursor.lastrowid
                logger.info(f"Created order {order_id} for user {user_uuid}, product {product_id}")
                return order_id
        except Exception as e:
            logger.error(f"Error creating order: {e}")
            return 0
    
    async def update_order_creem_info(self, order_id: int, creem_order_id: str = None, 
                                    creem_checkout_id: str = None, creem_subscription_id: str = None):
        """更新订单的Creem相关信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    UPDATE tb_orders 
                    SET creem_order_id = ?, creem_checkout_id = ?, creem_subscription_id = ?,
                        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (creem_order_id, creem_checkout_id, creem_subscription_id, order_id))
                await db.commit()
                logger.info(f"Updated order {order_id} with Creem info")
        except Exception as e:
            logger.error(f"Error updating order Creem info: {e}")
    
    async def get_order_by_creem_order_id(self, creem_order_id: str) -> Optional[Dict[str, Any]]:
        """根据Creem订单ID获取订单信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT o.*, p.points, p.level
                    FROM tb_orders o
                    LEFT JOIN tb_products p ON o.product_id = p.product_id
                    WHERE o.creem_order_id = ?
                """, (creem_order_id,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting order by Creem order ID {creem_order_id}: {e}")
            return None
    
    async def get_order_by_checkout_id(self, checkout_id: str) -> Optional[Dict[str, Any]]:
        """根据checkout_id获取订单信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT o.*, p.points, p.level
                    FROM tb_orders o
                    LEFT JOIN tb_products p ON o.product_id = p.product_id
                    WHERE o.creem_checkout_id = ?
                """, (checkout_id,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting order by checkout ID {checkout_id}: {e}")
            return None
    
    async def complete_order(self, order_id: int, points_awarded: int) -> bool:
        """完成订单并标记状态"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    UPDATE tb_orders 
                    SET status = 'completed', points_awarded = ?,
                        updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ?
                """, (points_awarded, order_id))
                await db.commit()
                logger.info(f"Completed order {order_id} with {points_awarded} points")
                return True
        except Exception as e:
            logger.error(f"Error completing order {order_id}: {e}")
            return False
    
    async def get_user_orders(self, user_uuid: str, limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
        """获取用户订单历史"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT o.*, p.name as product_name, p.level
                    FROM tb_orders o
                    LEFT JOIN tb_products p ON o.product_id = p.product_id
                    WHERE o.user_uuid = ?
                    ORDER BY o.created_at DESC
                    LIMIT ? OFFSET ?
                """, (user_uuid, limit, offset))
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting orders for user {user_uuid}: {e}")
            return []
    
    async def add_user_points(self, user_uuid: str, points: int) -> bool:
        """为用户增加积分"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                await db.execute("""
                    UPDATE tb_user 
                    SET points = points + ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE uuid = ?
                """, (points, user_uuid))
                await db.commit()
                logger.info(f"Added {points} points to user {user_uuid}")
                return True
        except Exception as e:
            logger.error(f"Error adding points to user {user_uuid}: {e}")
            return False
    
    async def update_user_subscription(self, user_uuid: str, subscription_id: str = None, order_id: str = None) -> bool:
        """更新用户的订阅信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 构建动态更新语句
                update_fields = []
                params = []
                
                if subscription_id is not None:
                    update_fields.append("subscription_id = ?")
                    params.append(subscription_id)
                
                if order_id is not None:
                    update_fields.append("order_id = ?")
                    params.append(order_id)
                
                if not update_fields:
                    logger.warning(f"No subscription fields to update for user {user_uuid}")
                    return True
                
                # 总是更新mtime
                update_fields.append("mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')")
                params.append(user_uuid)  # 添加WHERE条件的参数
                
                sql = f"""
                    UPDATE tb_user 
                    SET {', '.join(update_fields)}
                    WHERE uuid = ?
                """
                
                await db.execute(sql, params)
                await db.commit()
                
                logger.info(f"Updated subscription info for user {user_uuid}: subscription_id={subscription_id}, order_id={order_id}")
                return True
                
        except Exception as e:
            logger.error(f"Error updating subscription info for user {user_uuid}: {e}")
            return False
    
    async def clear_user_subscription(self, user_uuid: str) -> bool:
        """清空用户的订阅信息（设置为NULL）"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                sql = """
                    UPDATE tb_user 
                    SET subscription_id = NULL, 
                        order_id = NULL,
                        mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE uuid = ?
                """
                
                await db.execute(sql, (user_uuid,))
                await db.commit()
                
                logger.info(f"Cleared subscription info for user {user_uuid}")
                return True
                
        except Exception as e:
            logger.error(f"Error clearing subscription info for user {user_uuid}: {e}")
            return False
    
    async def get_user_subscription_info(self, user_uuid: str) -> Optional[Dict[str, Any]]:
        """获取用户的订阅信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, email, nickname, level, subscription_id, order_id, points, mtime
                    FROM tb_user
                    WHERE uuid = ?
                """, (user_uuid,))
                row = await cursor.fetchone()
                return dict(row) if row else None
        except Exception as e:
            logger.error(f"Error getting subscription info for user {user_uuid}: {e}")
            return None

# Create a singleton instance
db_service = DatabaseService()
