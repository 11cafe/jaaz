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
        
        # Clean up any existing temporary tables from previous failed runs
        conn.execute("DROP TABLE IF EXISTS tb_products_new")
        conn.execute("DROP TABLE IF EXISTS tb_user_new")
        
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
        
        # Copy existing data with level conversion
        print("🔄 Copying and converting product data...")
        
        # Copy data row by row with level conversion
        cursor = conn.execute("SELECT * FROM tb_products")
        products = cursor.fetchall()
        
        for product in products:
            id, product_id, name, level, points, price_cents, description, is_active, created_at, updated_at = product
            
            # Convert level based on product_id naming pattern
            new_level = level  # Default to current level
            
            if 'monthly' in product_id or product_id == 'prod_QT1QHgJmtigUHce5HToDW' or product_id == 'prod_1Pnf8nR8OUqp55ziFzDNLM':
                # Monthly products
                if level == 'base':
                    new_level = 'base_monthly'
                elif level == 'pro':
                    new_level = 'pro_monthly'
                elif level == 'max':
                    new_level = 'max_monthly'
            elif 'yearly' in product_id:
                # Yearly products
                if level == 'base':
                    new_level = 'base_yearly'
                elif level == 'pro':
                    new_level = 'pro_yearly'
                elif level == 'max':
                    new_level = 'max_yearly'
            
            print(f"  Converting product {name}: {level} -> {new_level}")
            
            # Insert with converted level
            conn.execute("""
                INSERT INTO tb_products_new 
                (id, product_id, name, level, points, price_cents, description, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (id, product_id, name, new_level, points, price_cents, description, is_active, created_at, updated_at))
        
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
        
        # Step 2: Product levels already converted during data copy above
        
        # Step 3: Update tb_user table constraint for new level values
        print("📝 Updating tb_user table constraints...")
        
        # Create new user table with updated level constraint
        conn.execute("""
            CREATE TABLE tb_user_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                nickname TEXT NOT NULL,
                ctime TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                mtime TEXT DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')),
                points INTEGER DEFAULT 0,
                uuid TEXT UNIQUE NOT NULL,
                level TEXT DEFAULT 'free' 
                CHECK (level IN ('free', 'base_monthly', 'pro_monthly', 'max_monthly', 'base_yearly', 'pro_yearly', 'max_yearly'))
            )
        """)
        
        # Copy existing data with level conversion
        print("🔄 Copying and converting user data...")
        
        # Copy data row by row with level conversion
        cursor = conn.execute("SELECT * FROM tb_user")
        users = cursor.fetchall()
        
        for user in users:
            id, email, nickname, ctime, mtime, points, uuid, level = user
            
            # Convert old level values to new format (default to monthly for paid users)
            new_level = level  # Default to current level
            
            if level == 'base':
                new_level = 'base_monthly'
            elif level == 'pro':
                new_level = 'pro_monthly'
            elif level == 'max':
                new_level = 'max_monthly'
            elif level == 'free' or level is None or level == '':
                new_level = 'free'
            
            print(f"  Converting user {email}: {level} -> {new_level}")
            
            # Insert with converted level
            conn.execute("""
                INSERT INTO tb_user_new 
                (id, email, nickname, ctime, mtime, points, uuid, level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (id, email, nickname, ctime, mtime, points, uuid, new_level))
        
        # Drop old table and rename new one
        conn.execute("DROP TABLE tb_user")
        conn.execute("ALTER TABLE tb_user_new RENAME TO tb_user")
        
        # Recreate indexes for tb_user
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_email 
            ON tb_user(email)
        """)
        
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_user_uuid 
            ON tb_user(uuid)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_tb_user_level 
            ON tb_user(level)
        """)
        
        # Step 4: User levels already converted during data copy above
        
        print("✅ Level system successfully upgraded")
        print("✅ Products updated with new level format")
        print("✅ Existing users migrated (paid users → monthly, others → free)")
        print("✅ Database constraints updated")

    def down(self, conn: sqlite3.Connection) -> None:
        """Rollback level system upgrade (not implemented for safety)"""
        print("⚠️ Rollback for level system upgrade is not implemented for data safety")
        print("⚠️ Manual intervention required if rollback is needed")
        pass