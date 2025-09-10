from . import Migration
import sqlite3


class V11UpgradeLevelSystem(Migration):
    version = 11
    description = "Upgrade level system to support monthly/yearly differentiation"

    def up(self, conn: sqlite3.Connection) -> None:
        """Upgrade level system to include billing period"""
        
        print("🎯 Upgrading level system to support monthly/yearly differentiation...")
        
        # Step 1: Update tb_products level constraint to support new level values
        print("📝 Updating tb_products table constraints...")
        
        # Create new table with updated constraints
        conn.execute("""
            CREATE TABLE tb_products_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                level TEXT NOT NULL CHECK (level IN ('free', 'base_monthly', 'pro_monthly', 'max_monthly', 'base_yearly', 'pro_yearly', 'max_yearly')),
                points INTEGER NOT NULL DEFAULT 0,
                price_cents INTEGER NOT NULL DEFAULT 0,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updated_at TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
        """)
        
        # Copy existing data
        conn.execute("""
            INSERT INTO tb_products_new 
            SELECT * FROM tb_products
        """)
        
        # Drop old table and rename new one
        conn.execute("DROP TABLE tb_products")
        conn.execute("ALTER TABLE tb_products_new RENAME TO tb_products")
        
        # Recreate indexes
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_products_product_id 
            ON tb_products(product_id)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_products_level 
            ON tb_products(level)
        """)
        
        # Step 2: Update existing products to use new level format
        print("🔄 Updating existing product levels...")
        
        # Update monthly products
        conn.execute("""
            UPDATE tb_products 
            SET level = 'base_monthly', updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE product_id LIKE '%monthly%' AND level = 'base'
        """)
        
        conn.execute("""
            UPDATE tb_products 
            SET level = 'pro_monthly', updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE product_id LIKE '%monthly%' AND level = 'pro'
        """)
        
        conn.execute("""
            UPDATE tb_products 
            SET level = 'max_monthly', updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE product_id LIKE '%monthly%' AND level = 'max'
        """)
        
        # Update yearly products
        conn.execute("""
            UPDATE tb_products 
            SET level = 'base_yearly', updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE product_id LIKE '%yearly%' AND level = 'base'
        """)
        
        conn.execute("""
            UPDATE tb_products 
            SET level = 'pro_yearly', updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE product_id LIKE '%yearly%' AND level = 'pro'
        """)
        
        conn.execute("""
            UPDATE tb_products 
            SET level = 'max_yearly', updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE product_id LIKE '%yearly%' AND level = 'max'
        """)
        
        # Step 3: Update tb_user table constraint for new level values
        print("📝 Updating tb_user table constraints...")
        
        # Get current table schema
        cursor = conn.execute("PRAGMA table_info(tb_user)")
        columns = cursor.fetchall()
        
        # Create new user table with updated level constraint
        create_sql = "CREATE TABLE tb_user_new ("
        column_defs = []
        
        for col in columns:
            col_name = col[1]
            col_type = col[2]
            not_null = " NOT NULL" if col[3] else ""
            default = f" DEFAULT {col[4]}" if col[4] is not None else ""
            pk = " PRIMARY KEY" if col[5] else ""
            
            if col_name == 'level':
                # Update level column with new constraint
                column_defs.append(f"level TEXT CHECK (level IN ('free', 'base_monthly', 'pro_monthly', 'max_monthly', 'base_yearly', 'pro_yearly', 'max_yearly')) DEFAULT 'free'")
            else:
                column_defs.append(f"{col_name} {col_type}{not_null}{default}{pk}")
        
        create_sql += ", ".join(column_defs) + ")"
        conn.execute(create_sql)
        
        # Copy existing data
        conn.execute("""
            INSERT INTO tb_user_new 
            SELECT * FROM tb_user
        """)
        
        # Drop old table and rename new one
        conn.execute("DROP TABLE tb_user")
        conn.execute("ALTER TABLE tb_user_new RENAME TO tb_user")
        
        # Step 4: Migrate existing user levels to new format (默认转换为monthly)
        print("🔄 Migrating existing user levels...")
        
        # Update existing users (assume monthly if they had a paid plan)
        conn.execute("""
            UPDATE tb_user 
            SET level = 'base_monthly', mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE level = 'base'
        """)
        
        conn.execute("""
            UPDATE tb_user 
            SET level = 'pro_monthly', mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE level = 'pro'
        """)
        
        conn.execute("""
            UPDATE tb_user 
            SET level = 'max_monthly', mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE level = 'max'
        """)
        
        # Set null/empty levels to free
        conn.execute("""
            UPDATE tb_user 
            SET level = 'free', mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE level IS NULL OR level = ''
        """)
        
        print("✅ Level system successfully upgraded")
        print("✅ Products updated with new level format")
        print("✅ Existing users migrated (paid users → monthly, others → free)")
        print("✅ Database constraints updated")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback level system upgrade (not implemented for safety)"""
        print("⚠️ Rollback for level system upgrade is not implemented for data safety")
        print("⚠️ Manual intervention required if rollback is needed")
        pass