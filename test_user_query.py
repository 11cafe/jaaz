#!/usr/bin/env python3

import asyncio
import sys
import os

# 添加server目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.db_service import db_service

async def test_user_query():
    """测试用户查询功能"""
    
    print("🧪 测试用户数据查询")
    print("=" * 50)
    
    # 测试用户ID 2
    test_user_id = 2
    
    print(f"📋 查询用户ID: {test_user_id}")
    
    # 使用get_user_by_id方法查询
    user = await db_service.get_user_by_id(test_user_id)
    
    if user:
        print(f"✅ 查询成功，用户信息:")
        for key, value in user.items():
            print(f"   - {key}: {value}")
        
        subscription_id = user.get("subscription_id")
        print(f"\n🎯 订阅ID: {subscription_id}")
        print(f"🎯 订阅ID类型: {type(subscription_id)}")
        print(f"🎯 是否有订阅: {bool(subscription_id)}")
        
    else:
        print("❌ 用户不存在")

if __name__ == "__main__":
    asyncio.run(test_user_query())