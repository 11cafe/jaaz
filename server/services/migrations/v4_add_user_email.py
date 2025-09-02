from . import Migration
import sqlite3


class V4AddUserEmail(Migration):
    version = 4
    description = "Add user email column to canvases table"

    def up(self, conn: sqlite3.Connection) -> None:
        """Add email column to canvases table for user isolation"""
        
        # Check if email column already exists
        cursor = conn.execute("PRAGMA table_info(canvases)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'email' not in columns:
            # Add email column to canvases table
            conn.execute("""
                ALTER TABLE canvases 
                ADD COLUMN email TEXT DEFAULT 'anonymous'
            """)
            
            # Create index for faster email-based queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_canvases_email 
                ON canvases(email, updated_at DESC)
            """)
            
            print("✅ Added email column to canvases table")
        else:
            print("⚠️ Email column already exists in canvases table")

    def down(self, conn: sqlite3.Connection) -> None:
        """Remove email column from canvases table"""
        
        # SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
        conn.execute("""
            CREATE TABLE canvases_new (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                data TEXT,
                description TEXT DEFAULT '',
                thumbnail TEXT DEFAULT '',
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
        """)

        # Copy data without email column
        conn.execute("""
            INSERT INTO canvases_new (id, name, data, description, thumbnail, created_at, updated_at)
            SELECT id, name, data, description, thumbnail, created_at, updated_at 
            FROM canvases
        """)

        # Drop old table and rename new one
        conn.execute("DROP TABLE canvases")
        conn.execute("ALTER TABLE canvases_new RENAME TO canvases")
        
        # Recreate original index
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_canvases_updated_at 
            ON canvases(updated_at DESC, id DESC)
        """)
        
        print("✅ Removed email column from canvases table")