from . import Migration
import sqlite3


class V7RenameUserIdToUuid(Migration):
    version = 7
    description = "Rename user_id columns to uuid in tb_canvases, tb_chat_sessions, tb_chat_messages for direct UUID foreign keys"

    def up(self, conn: sqlite3.Connection) -> None:
        """Rename user_id columns to uuid in related tables"""
        
        # 1. 更新 tb_canvases 表
        print("📋 Updating tb_canvases table...")
        
        # 创建新的 tb_canvases 表
        conn.execute("""
            CREATE TABLE tb_canvases_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT,
                description TEXT DEFAULT '',
                thumbnail TEXT DEFAULT '',
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                email TEXT DEFAULT 'anonymous',
                uuid TEXT NOT NULL,
                FOREIGN KEY (uuid) REFERENCES tb_user(uuid)
            )
        """)
        
        # 复制数据，将user_id转换为对应的uuid
        conn.execute("""
            INSERT INTO tb_canvases_new (id, name, data, description, thumbnail, created_at, updated_at, email, uuid)
            SELECT c.id, c.name, c.data, c.description, c.thumbnail, c.created_at, c.updated_at, c.email, u.uuid
            FROM tb_canvases c
            LEFT JOIN tb_user u ON c.user_id = u.id
        """)
        
        # 删除旧表并重命名
        conn.execute("DROP TABLE tb_canvases")
        conn.execute("ALTER TABLE tb_canvases_new RENAME TO tb_canvases")
        
        # 重新创建索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_canvases_uuid 
            ON tb_canvases(uuid, updated_at DESC)
        """)
        
        # 2. 更新 tb_chat_sessions 表
        print("💬 Updating tb_chat_sessions table...")
        
        conn.execute("""
            CREATE TABLE tb_chat_sessions_new (
                id TEXT PRIMARY KEY,
                canvas_id TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                title TEXT,
                model TEXT,
                provider TEXT,
                uuid TEXT NOT NULL,
                FOREIGN KEY (canvas_id) REFERENCES tb_canvases(id),
                FOREIGN KEY (uuid) REFERENCES tb_user(uuid)
            )
        """)
        
        # 复制数据
        conn.execute("""
            INSERT INTO tb_chat_sessions_new (id, canvas_id, created_at, updated_at, title, model, provider, uuid)
            SELECT s.id, s.canvas_id, s.created_at, s.updated_at, s.title, s.model, s.provider, u.uuid
            FROM tb_chat_sessions s
            LEFT JOIN tb_user u ON s.user_id = u.id
        """)
        
        conn.execute("DROP TABLE tb_chat_sessions")
        conn.execute("ALTER TABLE tb_chat_sessions_new RENAME TO tb_chat_sessions")
        
        # 重新创建索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_chat_sessions_uuid 
            ON tb_chat_sessions(uuid, updated_at DESC)
        """)
        
        # 3. 更新 tb_chat_messages 表
        print("📝 Updating tb_chat_messages table...")
        
        conn.execute("""
            CREATE TABLE tb_chat_messages_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                message TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                uuid TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES tb_chat_sessions(id),
                FOREIGN KEY (uuid) REFERENCES tb_user(uuid)
            )
        """)
        
        # 复制数据
        conn.execute("""
            INSERT INTO tb_chat_messages_new (id, session_id, role, message, created_at, updated_at, uuid)
            SELECT m.id, m.session_id, m.role, m.message, m.created_at, m.updated_at, u.uuid
            FROM tb_chat_messages m
            LEFT JOIN tb_user u ON m.user_id = u.id
        """)
        
        conn.execute("DROP TABLE tb_chat_messages")
        conn.execute("ALTER TABLE tb_chat_messages_new RENAME TO tb_chat_messages")
        
        # 重新创建索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_chat_messages_session_uuid 
            ON tb_chat_messages(session_id, uuid, id)
        """)
        
        # 4. 更新 tb_comfy_workflows 表
        print("⚙️ Updating tb_comfy_workflows table...")
        
        conn.execute("""
            CREATE TABLE tb_comfy_workflows_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                api_json TEXT,
                description TEXT DEFAULT '',
                inputs TEXT,
                outputs TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                uuid TEXT NOT NULL,
                FOREIGN KEY (uuid) REFERENCES tb_user(uuid)
            )
        """)
        
        # 复制数据
        conn.execute("""
            INSERT INTO tb_comfy_workflows_new (id, name, api_json, description, inputs, outputs, created_at, updated_at, uuid)
            SELECT w.id, w.name, w.api_json, w.description, w.inputs, w.outputs, w.created_at, w.updated_at, u.uuid
            FROM tb_comfy_workflows w
            LEFT JOIN tb_user u ON w.user_id = u.id
        """)
        
        conn.execute("DROP TABLE tb_comfy_workflows")
        conn.execute("ALTER TABLE tb_comfy_workflows_new RENAME TO tb_comfy_workflows")
        
        # 重新创建索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_comfy_workflows_uuid 
            ON tb_comfy_workflows(uuid, updated_at DESC)
        """)
        
        print("✅ All tables updated to use UUID foreign keys")
        print("✅ Data migration completed successfully")
        print("✅ Indexes recreated for optimal performance")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback UUID column changes (not implemented for safety)"""
        print("⚠️ Rollback for UUID migration is not implemented for data safety")
        pass