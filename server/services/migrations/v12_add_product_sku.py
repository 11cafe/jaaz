from . import Migration
import sqlite3


class V12AddProductSku(Migration):
    version = 12
    description = "Add SKU field to products table"

    def up(self, conn: sqlite3.Connection) -> None:
        """Add SKU field to products table"""
        
        print("🎯 Adding SKU field to tb_products table...")
        
        # 添加 SKU 字段（不能直接添加 UNIQUE 约束）
        conn.execute("""
            ALTER TABLE tb_products 
            ADD COLUMN sku TEXT
        """)
        
        # 为现有产品生成 SKU
        print("🔄 Generating SKU for existing products...")
        
        # 获取现有产品
        cursor = conn.execute("SELECT id, level FROM tb_products")
        products = cursor.fetchall()
        
        for product_id, level in products:
            # 根据 level 生成 SKU
            if level == 'base_monthly':
                sku = 'SKU-BASE-M'
            elif level == 'base_yearly':
                sku = 'SKU-BASE-Y'
            elif level == 'pro_monthly':
                sku = 'SKU-PRO-M'
            elif level == 'pro_yearly':
                sku = 'SKU-PRO-Y'
            elif level == 'max_monthly':
                sku = 'SKU-MAX-M'
            elif level == 'max_yearly':
                sku = 'SKU-MAX-Y'
            else:
                sku = f'SKU-{level.upper()}'
            
            # 如果有重复的 level，添加 ID 后缀
            existing = conn.execute("SELECT COUNT(*) FROM tb_products WHERE sku = ?", (sku,)).fetchone()[0]
            if existing > 0:
                sku = f"{sku}-{product_id}"
            
            conn.execute("UPDATE tb_products SET sku = ? WHERE id = ?", (sku, product_id))
            print(f"  - Product {product_id} ({level}): {sku}")
        
        # 创建 SKU 的唯一索引
        conn.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_tb_products_sku 
            ON tb_products(sku)
        """)
        
        print("✅ SKU field added successfully")

    def down(self, conn: sqlite3.Connection) -> None:
        """Remove SKU field from products table"""
        print("⚠️ SKU field removal not implemented for data safety")
        pass