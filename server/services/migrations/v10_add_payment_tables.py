from . import Migration
import sqlite3


class V10AddPaymentTables(Migration):
    version = 10
    description = "Add payment system tables: tb_products and tb_orders"

    def up(self, conn: sqlite3.Connection) -> None:
        """Create payment system tables"""
        
        print("🎯 Creating payment system tables...")
        
        # Create tb_products table for product configuration
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                level TEXT NOT NULL CHECK (level IN ('base', 'pro', 'max')),
                points INTEGER NOT NULL DEFAULT 0,
                price_cents INTEGER NOT NULL DEFAULT 0,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
        """)
        
        # Create index for product queries
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_products_product_id 
            ON tb_products(product_id)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_products_level 
            ON tb_products(level)
        """)
        
        # Create tb_orders table for order tracking
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tb_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uuid TEXT NOT NULL,
                product_id TEXT NOT NULL,
                creem_order_id TEXT,
                creem_checkout_id TEXT,
                creem_subscription_id TEXT,
                status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
                points_awarded INTEGER DEFAULT 0,
                price_cents INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                FOREIGN KEY (user_uuid) REFERENCES tb_user(uuid),
                FOREIGN KEY (product_id) REFERENCES tb_products(product_id)
            )
        """)
        
        # Create indexes for order queries
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_orders_user_uuid 
            ON tb_orders(user_uuid)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_orders_creem_order_id 
            ON tb_orders(creem_order_id)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_orders_status 
            ON tb_orders(status)
        """)
        
        # Insert initial product configurations
        products_data = [
            ('prod_base_monthly', 'Base Plan Monthly', 'base', 1000, 999, 'Basic features with monthly billing'),
            ('prod_pro_monthly', 'Pro Plan Monthly', 'pro', 5000, 2999, 'Pro features with monthly billing'),
            ('prod_max_monthly', 'Max Plan Monthly', 'max', 10000, 4999, 'Maximum features with monthly billing'),
            ('prod_base_yearly', 'Base Plan Yearly', 'base', 12000, 9999, 'Basic features with yearly billing (save 17%)'),
            ('prod_pro_yearly', 'Pro Plan Yearly', 'pro', 60000, 29999, 'Pro features with yearly billing (save 17%)'),
            ('prod_max_yearly', 'Max Plan Yearly', 'max', 120000, 49999, 'Maximum features with yearly billing (save 17%)')
        ]
        
        for product in products_data:
            conn.execute("""
                INSERT INTO tb_products (product_id, name, level, points, price_cents, description)
                VALUES (?, ?, ?, ?, ?, ?)
            """, product)
        
        print("✅ Payment tables created successfully")
        print("✅ Product configurations inserted")
        print("✅ Indexes created for efficient queries")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback payment tables (not implemented for safety)"""
        print("⚠️ Rollback for payment tables migration is not implemented for data safety")
        pass