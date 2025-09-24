#!/usr/bin/env python3
"""
优化产品数据：统一产品ID格式和数据
"""

import sqlite3
import os

def optimize_products():
    print("🔧 优化产品数据...")
    
    db_path = "/Users/caijunjie/Dev/open-jaaz/server/user_data/localmanus.db"
    
    with sqlite3.connect(db_path) as conn:
        # 1. 查看当前产品数据
        print("\n📋 当前产品数据:")
        cursor = conn.execute("SELECT id, product_id, name, level, price_cents FROM tb_products ORDER BY level")
        products = cursor.fetchall()
        
        for product in products:
            print(f"  {product[0]}: {product[1]} | {product[2]} | {product[3]} | ${product[4]/100:.2f}")
        
        # 2. 清理重复的产品
        print("\n🧹 清理重复产品...")
        
        # 删除旧的测试产品，保留真实的 Creem 产品ID
        products_to_keep = {
            'base_monthly': 'prod_1Pnf8nR8OUqp55ziFzDNLM',  # 真实的 Creem 产品
            'base_yearly': 'prod_base_yearly',
            'pro_monthly': 'prod_pro_monthly', 
            'pro_yearly': 'prod_pro_yearly',
            'max_monthly': 'prod_max_monthly',
            'max_yearly': 'prod_max_yearly',
        }
        
        # 获取所有产品
        all_products = conn.execute("SELECT id, product_id, level FROM tb_products").fetchall()
        
        for level, keep_product_id in products_to_keep.items():
            # 找到这个level的所有产品
            level_products = [p for p in all_products if p[2] == level]
            
            if len(level_products) > 1:
                print(f"  📦 Level {level} 有 {len(level_products)} 个产品:")
                for p in level_products:
                    print(f"    - ID {p[0]}: {p[1]}")
                
                # 保留指定的产品，删除其他的
                for p in level_products:
                    if p[1] != keep_product_id:
                        print(f"    🗑️ 删除重复产品: {p[1]}")
                        conn.execute("DELETE FROM tb_products WHERE id = ?", (p[0],))
        
        # 3. 确保所需的产品都存在
        print("\n✅ 确保所需产品存在...")
        
        product_definitions = [
            ('prod_1Pnf8nR8OUqp55ziFzDNLM', 'Base Plan Monthly', 'base_monthly', 1000, 999, 'Basic features with monthly billing'),
            ('prod_base_yearly', 'Base Plan Yearly', 'base_yearly', 12000, 9999, 'Basic features with yearly billing (save 17%)'),
            ('prod_pro_monthly', 'Pro Plan Monthly', 'pro_monthly', 5000, 2999, 'Pro features with monthly billing'),
            ('prod_pro_yearly', 'Pro Plan Yearly', 'pro_yearly', 60000, 29999, 'Pro features with yearly billing (save 17%)'),
            ('prod_max_monthly', 'Max Plan Monthly', 'max_monthly', 10000, 4999, 'Maximum features with monthly billing'),
            ('prod_max_yearly', 'Max Plan Yearly', 'max_yearly', 120000, 49999, 'Maximum features with yearly billing (save 17%)'),
        ]
        
        for product_id, name, level, points, price_cents, description in product_definitions:
            existing = conn.execute("SELECT id FROM tb_products WHERE product_id = ?", (product_id,)).fetchone()
            
            if not existing:
                print(f"  ➕ 添加缺失产品: {product_id} ({name})")
                conn.execute("""
                    INSERT INTO tb_products (product_id, name, level, points, price_cents, description, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                """, (product_id, name, level, points, price_cents, description))
            else:
                print(f"  ✅ 产品已存在: {product_id}")
        
        # 4. 显示最终结果
        print("\n🎯 优化后的产品列表:")
        cursor = conn.execute("SELECT product_id, name, level, price_cents FROM tb_products ORDER BY level, price_cents")
        final_products = cursor.fetchall()
        
        for product in final_products:
            print(f"  ✓ {product[0]} | {product[1]} | {product[2]} | ${product[3]/100:.2f}")
        
        print(f"\n✅ 产品优化完成！共有 {len(final_products)} 个产品")

if __name__ == "__main__":
    optimize_products()