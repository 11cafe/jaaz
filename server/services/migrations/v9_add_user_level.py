from . import Migration
import sqlite3


class V9AddUserLevel(Migration):
    version = 9
    description = "Add level column to tb_user table for subscription tiers (free, base, pro, max)"

    def up(self, conn: sqlite3.Connection) -> None:
        """Add level column to tb_user table"""
        
        print("🎯 Adding level column to tb_user table...")
        
        # Add level column with default value 'free'
        conn.execute("""
            ALTER TABLE tb_user 
            ADD COLUMN level TEXT DEFAULT 'free' 
            CHECK (level IN ('free', 'base', 'pro', 'max'))
        """)
        
        # Update mtime for this schema change
        conn.execute("""
            UPDATE tb_user 
            SET mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
        """)
        
        # Create index for level queries
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_level 
            ON tb_user(level)
        """)
        
        print("✅ User level column added successfully")
        print("✅ Default level 'free' set for all existing users")
        print("✅ Level constraint (free, base, pro, max) created")
        print("✅ Level index created for efficient queries")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback level column addition (not implemented for safety)"""
        print("⚠️ Rollback for user level migration is not implemented for data safety")
        pass