#!/usr/bin/env python3

import asyncio
import sys
import os
import sqlite3

# 添加server目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.db_service import db_service
from services.payment_service import payment_service

async def test_cancel_subscription():
    """测试取消订阅功能"""
    
    print("🧪 测试取消订阅功能")
    print("=" * 50)
    
    # 1. 获取测试用户信息
    test_user_email = "yzcaijunjie@gmail.com"
    
    # 查询用户信息
    db_path = "/Users/caijunjie/Dev/open-jaaz/server/user_data/localmanus.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, email, uuid, level, subscription_id, order_id FROM tb_user WHERE email = ?", (test_user_email,))
    user_row = cursor.fetchone()
    
    if not user_row:
        print(f"❌ 测试用户 {test_user_email} 不存在")
        return
    
    user_id, email, user_uuid, level, subscription_id, order_id = user_row
    
    print(f"📋 测试用户信息:")
    print(f"   - ID: {user_id}")
    print(f"   - Email: {email}")
    print(f"   - UUID: {user_uuid}")
    print(f"   - Level: {level}")
    print(f"   - Subscription ID: {subscription_id}")
    print(f"   - Order ID: {order_id}")
    
    if not subscription_id:
        print("❌ 用户没有订阅信息，无法测试取消订阅")
        return
    
    print(f"\n🚀 开始测试取消订阅...")
    print(f"   - 将要取消的订阅ID: {subscription_id}")
    
    # 2. 调用Creem API取消订阅
    print("\n🔄 调用Creem API取消订阅...")
    cancel_result = await payment_service.cancel_subscription(subscription_id)
    
    print(f"📋 Creem API返回结果:")
    print(f"   - Success: {cancel_result.get('success')}")
    print(f"   - Error: {cancel_result.get('error', 'None')}")
    print(f"   - Subscription ID: {cancel_result.get('subscription_id', 'None')}")
    print(f"   - Status: {cancel_result.get('status', 'None')}")
    
    if cancel_result.get('success'):
        print("✅ Creem API取消订阅成功")
        
        # 3. 更新数据库
        print("\n🔄 更新数据库...")
        
        # 清空subscription_id和order_id
        update_success = await db_service.clear_user_subscription(user_uuid)
        
        if update_success:
            print("✅ 订阅信息清空成功")
            
            # 更新用户等级为free
            level_update_success = await db_service.update_user_level(user_id, 'free')
            if level_update_success:
                print("✅ 用户等级更新为free成功")
                
                # 验证更新结果
                cursor.execute("SELECT level, subscription_id, order_id FROM tb_user WHERE email = ?", (test_user_email,))
                updated_row = cursor.fetchone()
                
                print(f"\n📋 更新后的用户信息:")
                print(f"   - Level: {updated_row[0]}")
                print(f"   - Subscription ID: {updated_row[1]}")
                print(f"   - Order ID: {updated_row[2]}")
                
                print("\n🎉 取消订阅测试完成！")
            else:
                print("❌ 用户等级更新失败")
        else:
            print("❌ 订阅信息清空失败")
    else:
        print(f"❌ Creem API取消订阅失败: {cancel_result.get('error')}")
    
    conn.close()

if __name__ == "__main__":
    asyncio.run(test_cancel_subscription())