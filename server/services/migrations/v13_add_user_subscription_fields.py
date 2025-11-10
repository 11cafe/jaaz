from . import Migration
import sqlite3


class V13AddUserSubscriptionFields(Migration):
    version = 13
    description = "Add subscription_id and order_id fields to users table"

    def up(self, conn: sqlite3.Connection) -> None:
        """Add subscription_id and order_id fields to tb_user table"""
        
        print("🎯 Adding subscription fields to tb_user table...")
        
        # 添加 subscription_id 字段
        print("  - Adding subscription_id field...")
        conn.execute("""
            ALTER TABLE tb_user 
            ADD COLUMN subscription_id TEXT
        """)
        
        # 添加 order_id 字段
        print("  - Adding order_id field...")
        conn.execute("""
            ALTER TABLE tb_user 
            ADD COLUMN order_id TEXT
        """)
        
        # 创建索引以提高查询性能
        print("  - Creating indexes...")
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_subscription_id 
            ON tb_user(subscription_id)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_order_id 
            ON tb_user(order_id)
        """)
        
        print("✅ Subscription fields added successfully")
        print("   - subscription_id: The subscription ID of the product")
        print("   - order_id: The ID of the order created after successful payment")

    def down(self, conn: sqlite3.Connection) -> None:
        """Remove subscription fields from users table"""
        print("⚠️ Subscription fields removal not implemented for data safety")
        print("   Manual removal required if needed:")
        print("   ALTER TABLE tb_user DROP COLUMN subscription_id;")
        print("   ALTER TABLE tb_user DROP COLUMN order_id;")
        pass