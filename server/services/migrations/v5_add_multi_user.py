from . import Migration
import sqlite3


class V5AddMultiUser(Migration):
    version = 5
    description = "Add multi-user support with tb_user table and rename existing tables"

    def up(self, conn: sqlite3.Connection) -> None:
        """Implement multi-user support"""
        
        # 1. Create tb_user table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_user (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                nickname TEXT NOT NULL,
                ctime TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                mtime TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                points INTEGER DEFAULT 0
            )
        """)
        
        # Create index for email lookup
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_email 
            ON tb_user(email)
        """)
        
        # 2. Create default anonymous user
        conn.execute("""
            INSERT OR IGNORE INTO tb_user (id, email, nickname, points)
            VALUES (1, 'anonymous', 'Anonymous User', 0)
        """)
        
        # 3. Rename and migrate canvases table
        # Create new tb_canvases table with user_id
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_canvases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT,
                description TEXT DEFAULT '',
                thumbnail TEXT DEFAULT '',
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                email TEXT DEFAULT 'anonymous',
                user_id INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES tb_user(id)
            )
        """)
        
        # Copy data from old canvases table
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='canvases'")
        if cursor.fetchone():
            conn.execute("""
                INSERT INTO tb_canvases (id, name, data, description, thumbnail, created_at, updated_at, email, user_id)
                SELECT id, name, data, description, thumbnail, created_at, updated_at, 
                       COALESCE(email, 'anonymous'), 1
                FROM canvases
            """)
            # Drop old table
            conn.execute("DROP TABLE canvases")
        
        # Create indexes for tb_canvases
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_canvases_user_id 
            ON tb_canvases(user_id, updated_at DESC)
        """)
        
        # 4. Rename and migrate chat_sessions table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_chat_sessions (
                id TEXT PRIMARY KEY,
                canvas_id TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                title TEXT,
                model TEXT,
                provider TEXT,
                user_id INTEGER DEFAULT 1,
                FOREIGN KEY (canvas_id) REFERENCES tb_canvases(id),
                FOREIGN KEY (user_id) REFERENCES tb_user(id)
            )
        """)
        
        # Copy data from old chat_sessions table
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_sessions'")
        if cursor.fetchone():
            conn.execute("""
                INSERT INTO tb_chat_sessions (id, canvas_id, created_at, updated_at, title, model, provider, user_id)
                SELECT id, canvas_id, created_at, updated_at, title, model, provider, 1
                FROM chat_sessions
            """)
            # Drop old table
            conn.execute("DROP TABLE chat_sessions")
        
        # Create indexes for tb_chat_sessions
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_chat_sessions_user_id 
            ON tb_chat_sessions(user_id, updated_at DESC)
        """)
        
        # 5. Rename and migrate chat_messages table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                role TEXT,
                message TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                user_id INTEGER DEFAULT 1,
                FOREIGN KEY (session_id) REFERENCES tb_chat_sessions(id),
                FOREIGN KEY (user_id) REFERENCES tb_user(id)
            )
        """)
        
        # Copy data from old chat_messages table
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'")
        if cursor.fetchone():
            conn.execute("""
                INSERT INTO tb_chat_messages (id, session_id, role, message, created_at, updated_at, user_id)
                SELECT id, session_id, role, message, created_at, updated_at, 1
                FROM chat_messages
            """)
            # Drop old table
            conn.execute("DROP TABLE chat_messages")
        
        # Create indexes for tb_chat_messages
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_chat_messages_session_user 
            ON tb_chat_messages(session_id, user_id, id)
        """)
        
        # 6. Rename and migrate comfy_workflows table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_comfy_workflows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                api_json TEXT,
                description TEXT DEFAULT '',
                inputs TEXT,
                outputs TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                user_id INTEGER DEFAULT 1,
                FOREIGN KEY (user_id) REFERENCES tb_user(id)
            )
        """)
        
        # Copy data from old comfy_workflows table
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='comfy_workflows'")
        if cursor.fetchone():
            conn.execute("""
                INSERT INTO tb_comfy_workflows (id, name, api_json, description, inputs, outputs, created_at, updated_at, user_id)
                SELECT id, name, api_json, description, inputs, outputs, created_at, updated_at, 1
                FROM comfy_workflows
            """)
            # Drop old table
            conn.execute("DROP TABLE comfy_workflows")
        
        # Create indexes for tb_comfy_workflows
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_comfy_workflows_user_id 
            ON tb_comfy_workflows(user_id, updated_at DESC)
        """)
        
        print("✅ Multi-user support added successfully")
        print("✅ All tables renamed with tb_ prefix")
        print("✅ User ID columns added to all tables")
        print("✅ Default anonymous user created")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback multi-user support (not implemented for safety)"""
        print("⚠️ Rollback for multi-user migration is not implemented for data safety")
        pass