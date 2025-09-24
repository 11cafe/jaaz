#!/usr/bin/env python3

import asyncio
import sys
import os

# 添加server目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.db_service import db_service
from services.payment_service import payment_service

async def test_cancel_api_logic():
    """测试取消订阅API的完整逻辑"""
    
    print("🧪 测试取消订阅API逻辑")
    print("=" * 50)
    
    # 模拟API逻辑
    user_id = 2
    
    try:
        print(f"1. 📋 获取用户信息 (user_id: {user_id})")
        
        # 获取用户信息 - 使用修改后的方法
        user = await db_service.get_user_by_id(user_id)
        if not user:
            print("❌ 用户不存在")
            return
        
        print(f"✅ 用户信息获取成功:")
        print(f"   - Email: {user.get('email')}")
        print(f"   - Level: {user.get('level')}")
        print(f"   - UUID: {user.get('uuid')}")
        
        print(f"\n2. 🔍 检查订阅信息")
        
        # 检查用户是否有有效的订阅
        subscription_id = user.get("subscription_id")
        print(f"   - Subscription ID: {subscription_id}")
        print(f"   - 有订阅: {bool(subscription_id)}")
        
        if not subscription_id:
            print("❌ 没有活跃的订阅")
            return
        
        print(f"\n3. 🚀 调用Creem API取消订阅")
        print(f"   - 要取消的订阅ID: {subscription_id}")
        
        # 调用Creem API取消订阅
        cancel_result = await payment_service.cancel_subscription(subscription_id)
        
        print(f"📋 Creem API结果:")
        print(f"   - Success: {cancel_result.get('success')}")
        print(f"   - Status: {cancel_result.get('status')}")
        print(f"   - Error: {cancel_result.get('error', 'None')}")
        
        if not cancel_result.get("success"):
            print(f"❌ 取消订阅失败: {cancel_result.get('error')}")
            return
        
        print(f"\n4. 💾 更新数据库")
        
        # 清空用户订阅信息
        user_uuid = user.get("uuid")
        print(f"   - 清空用户 {user_uuid} 的订阅信息")
        
        update_success = await db_service.clear_user_subscription(user_uuid)
        
        if update_success:
            print("✅ 订阅信息清空成功")
            
            # 更新用户等级为free
            level_update_success = await db_service.update_user_level(user_id, 'free')
            if level_update_success:
                print("✅ 用户等级更新为free成功")
                print("\n🎉 取消订阅完整流程测试成功！")
            else:
                print("❌ 用户等级更新失败")
        else:
            print("❌ 订阅信息清空失败")
            
    except Exception as e:
        print(f"❌ 测试过程中发生错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_cancel_api_logic())