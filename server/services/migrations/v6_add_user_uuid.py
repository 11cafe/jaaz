from . import Migration
import sqlite3
import uuid


class V6AddUserUuid(Migration):
    version = 6
    description = "Add UUID field to tb_user table for unique user identification"

    def up(self, conn: sqlite3.Connection) -> None:
        """Add UUID field to tb_user table"""
        
        # SQLite不支持直接添加带UNIQUE约束的列，需要采用重建表的方式
        
        # 1. 先添加uuid列（不带约束）
        conn.execute("""
            ALTER TABLE tb_user 
            ADD COLUMN uuid TEXT
        """)
        
        # 2. 为现有用户生成UUID
        cursor = conn.execute("SELECT id FROM tb_user")
        users = cursor.fetchall()
        
        for user in users:
            user_id = user[0]
            user_uuid = str(uuid.uuid4())
            conn.execute("""
                UPDATE tb_user 
                SET uuid = ?
                WHERE id = ?
            """, (user_uuid, user_id))
        
        # 3. 创建新表结构（包含UNIQUE约束）
        conn.execute("""
            CREATE TABLE tb_user_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                nickname TEXT NOT NULL,
                ctime TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                mtime TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                points INTEGER DEFAULT 0,
                uuid TEXT UNIQUE NOT NULL
            )
        """)
        
        # 4. 复制数据到新表
        conn.execute("""
            INSERT INTO tb_user_new (id, email, nickname, ctime, mtime, points, uuid)
            SELECT id, email, nickname, ctime, mtime, points, uuid
            FROM tb_user
        """)
        
        # 5. 删除旧表
        conn.execute("DROP TABLE tb_user")
        
        # 6. 重命名新表
        conn.execute("ALTER TABLE tb_user_new RENAME TO tb_user")
        
        # 7. 重新创建索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_email 
            ON tb_user(email)
        """)
        
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_user_uuid 
            ON tb_user(uuid)
        """)
        
        print("✅ UUID field added to tb_user table with UNIQUE constraint")
        print("✅ UUIDs generated for existing users")
        print("✅ Table structure updated with proper constraints")
        print("✅ UUID index created")

    def down(self, conn: sqlite3.Connection) -> None:
        """Remove UUID field from tb_user table (not implemented for safety)"""
        print("⚠️ Rollback for UUID migration is not implemented for data safety")
        pass