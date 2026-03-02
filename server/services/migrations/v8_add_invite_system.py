from . import Migration
import sqlite3


class V8AddInviteSystem(Migration):
    version = 8
    description = "Add invite system tables for referral rewards (point transactions, invite codes, invitations)"

    def up(self, conn: sqlite3.Connection) -> None:
        """Add invite system tables"""
        
        # 1. 创建积分交易记录表
        print("💰 Creating tb_point_transactions table...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_point_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_uuid TEXT NOT NULL,
                points INTEGER NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('earn_invite', 'earn_register', 'spend', 'admin_adjust')),
                description TEXT NOT NULL,
                reference_id TEXT,
                balance_after INTEGER NOT NULL,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                FOREIGN KEY (user_id) REFERENCES tb_user(id),
                FOREIGN KEY (user_uuid) REFERENCES tb_user(uuid)
            )
        """)
        
        # 创建积分交易记录索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_point_transactions_user 
            ON tb_point_transactions(user_uuid, created_at DESC)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_point_transactions_type 
            ON tb_point_transactions(type, created_at DESC)
        """)
        
        # 2. 创建邀请码表
        print("🎟️ Creating tb_invite_codes table...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_invite_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                user_uuid TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                used_count INTEGER DEFAULT 0,
                max_uses INTEGER DEFAULT 500,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                FOREIGN KEY (user_id) REFERENCES tb_user(id),
                FOREIGN KEY (user_uuid) REFERENCES tb_user(uuid)
            )
        """)
        
        # 创建邀请码索引
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_invite_codes_code 
            ON tb_invite_codes(code)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_invite_codes_user 
            ON tb_invite_codes(user_uuid, is_active)
        """)
        
        # 3. 创建邀请记录表
        print("📋 Creating tb_invitations table...")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_invitations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inviter_id INTEGER NOT NULL,
                inviter_uuid TEXT NOT NULL,
                invitee_id INTEGER,
                invitee_uuid TEXT,
                invite_code TEXT NOT NULL,
                invitee_email TEXT,
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'completed')),
                inviter_points_awarded INTEGER DEFAULT 0,
                invitee_points_awarded INTEGER DEFAULT 0,
                registration_ip TEXT,
                registration_user_agent TEXT,
                device_fingerprint TEXT,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                completed_at TEXT,
                FOREIGN KEY (inviter_id) REFERENCES tb_user(id),
                FOREIGN KEY (inviter_uuid) REFERENCES tb_user(uuid),
                FOREIGN KEY (invitee_id) REFERENCES tb_user(id),
                FOREIGN KEY (invitee_uuid) REFERENCES tb_user(uuid),
                FOREIGN KEY (invite_code) REFERENCES tb_invite_codes(code)
            )
        """)
        
        # 创建邀请记录索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_invitations_inviter 
            ON tb_invitations(inviter_uuid, created_at DESC)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_invitations_invitee 
            ON tb_invitations(invitee_uuid, status)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_invitations_code 
            ON tb_invitations(invite_code, status)
        """)
        
        # 创建防刷机制索引
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_invitations_ip_time 
            ON tb_invitations(registration_ip, created_at DESC)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_invitations_device_time 
            ON tb_invitations(device_fingerprint, created_at DESC)
        """)
        
        # 4. 为现有用户创建积分交易记录（如果有积分的话）
        print("💳 Creating initial point transaction records...")
        conn.execute("""
            INSERT INTO tb_point_transactions (user_id, user_uuid, points, type, description, balance_after)
            SELECT id, uuid, points, 'admin_adjust', 'Initial balance migration', points
            FROM tb_user 
            WHERE points > 0
        """)
        
        print("✅ Invite system tables created successfully")
        print("✅ Point transaction tracking enabled")
        print("✅ Invite codes system ready")
        print("✅ Anti-spam protection indexes created")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback invite system tables (not implemented for safety)"""
        print("⚠️ Rollback for invite system migration is not implemented for data safety")
        pass