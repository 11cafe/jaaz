#!/usr/bin/env python3

import sys
import os
import sqlite3

# 添加server目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.migrations.manager import MigrationManager, CURRENT_VERSION

def run_migration():
    """运行订阅字段迁移"""
    
    db_path = "server/user_data/localmanus.db"
    
    print("🚀 开始运行数据库迁移...")
    print(f"📍 数据库路径: {db_path}")
    
    try:
        with sqlite3.connect(db_path) as conn:
            # 获取当前版本
            cursor = conn.execute("SELECT version FROM db_version")
            current_version = cursor.fetchone()[0]
            print(f"🔍 当前数据库版本: {current_version}")
            print(f"🎯 目标版本: {CURRENT_VERSION}")
            
            if current_version >= CURRENT_VERSION:
                print("✅ 数据库已经是最新版本，无需迁移")
                return
            
            # 执行迁移
            migration_manager = MigrationManager()
            migration_manager.migrate(conn, current_version, CURRENT_VERSION)
            
            # 更新版本号
            conn.execute("UPDATE db_version SET version = ?", (CURRENT_VERSION,))
            conn.commit()
            
            print(f"✅ 迁移完成！数据库版本已更新到 {CURRENT_VERSION}")
            
            # 验证字段是否添加成功
            print("\n🔍 验证新增字段...")
            cursor = conn.execute("PRAGMA table_info(tb_user)")
            columns = cursor.fetchall()
            
            subscription_id_exists = any(col[1] == 'subscription_id' for col in columns)
            order_id_exists = any(col[1] == 'order_id' for col in columns)
            
            print(f"   - subscription_id字段: {'✅ 存在' if subscription_id_exists else '❌ 不存在'}")
            print(f"   - order_id字段: {'✅ 存在' if order_id_exists else '❌ 不存在'}")
            
            if subscription_id_exists and order_id_exists:
                print("🎉 所有字段都已成功添加！")
            else:
                print("⚠️ 部分字段添加失败，请检查迁移脚本")
                
    except Exception as e:
        print(f"❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_migration()