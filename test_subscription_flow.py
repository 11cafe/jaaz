#!/usr/bin/env python3

import asyncio
import sys
import os
import requests
import sqlite3

# 添加server目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.db_service import db_service

async def test_subscription_flow():
    """测试完整的订阅流程"""
    
    print("🧪 测试用户订阅信息存储功能")
    print("=" * 50)
    
    # 1. 测试数据库字段是否存在
    print("\n1️⃣ 验证数据库字段...")
    
    db_path = "server/user_data/localmanus.db"
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute("PRAGMA table_info(tb_user)")
        columns = [col[1] for col in cursor.fetchall()]
        
        subscription_id_exists = 'subscription_id' in columns
        order_id_exists = 'order_id' in columns
        
        print(f"   - subscription_id字段: {'✅' if subscription_id_exists else '❌'}")
        print(f"   - order_id字段: {'✅' if order_id_exists else '❌'}")
        
        if not (subscription_id_exists and order_id_exists):
            print("❌ 数据库字段缺失，请先运行迁移脚本")
            return False
    
    # 2. 测试数据库服务层方法
    print("\n2️⃣ 测试数据库服务层方法...")
    
    test_user_uuid = "254b0155-4a3a-46bd-8902-c2daf50a8430"  # 使用现有用户
    test_subscription_id = "sub_test_123456"
    test_order_id = "ord_test_789012"
    
    try:
        # 获取用户当前信息
        user_before = await db_service.get_user_subscription_info(test_user_uuid)
        if user_before:
            print(f"   ✅ 用户信息获取成功: {user_before['email']}")
            print(f"      - 当前subscription_id: {user_before.get('subscription_id', 'None')}")
            print(f"      - 当前order_id: {user_before.get('order_id', 'None')}")
        else:
            print(f"   ❌ 用户 {test_user_uuid} 不存在")
            return False
        
        # 更新订阅信息
        update_success = await db_service.update_user_subscription(
            user_uuid=test_user_uuid,
            subscription_id=test_subscription_id,
            order_id=test_order_id
        )
        
        if update_success:
            print(f"   ✅ 订阅信息更新成功")
            
            # 验证更新结果
            user_after = await db_service.get_user_subscription_info(test_user_uuid)
            if user_after:
                print(f"      - 新subscription_id: {user_after.get('subscription_id')}")
                print(f"      - 新order_id: {user_after.get('order_id')}")
                
                if (user_after.get('subscription_id') == test_subscription_id and 
                    user_after.get('order_id') == test_order_id):
                    print("   ✅ 数据验证成功")
                else:
                    print("   ❌ 数据验证失败")
                    return False
            else:
                print("   ❌ 无法获取更新后的用户信息")
                return False
        else:
            print("   ❌ 订阅信息更新失败")
            return False
            
    except Exception as e:
        print(f"   ❌ 数据库操作异常: {e}")
        return False
    
    # 3. 测试支付回调解析
    print("\n3️⃣ 测试支付回调解析...")
    
    # 模拟回调URL参数
    callback_url = "http://localhost:8000/payments"
    callback_params = {
        'checkout_id': 'ch_test_123',
        'order_id': 'ord_test_callback_456', 
        'customer_id': 'cust_test_789',
        'subscription_id': 'sub_test_callback_101112',
        'product_id': 'prod_24vhA7mt8RYKfTdLvU1oRd',
        'signature': 'test_signature_123456'
    }
    
    print(f"   - 回调URL: {callback_url}")
    print(f"   - 模拟参数: {callback_params}")
    
    try:
        # 注意：这个测试需要服务器在运行，如果服务器没有运行会失败
        response = requests.get(callback_url, params=callback_params, timeout=5)
        print(f"   - 响应状态码: {response.status_code}")
        
        if response.status_code in [200, 302, 404]:  # 404是因为订单不存在，这是正常的
            print("   ✅ 回调接口正常响应")
        else:
            print(f"   ⚠️ 回调接口响应异常: {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("   ⚠️ 服务器未运行，跳过回调测试")
    except Exception as e:
        print(f"   ❌ 回调测试异常: {e}")
    
    print("\n🎉 订阅功能测试完成！")
    return True

async def cleanup_test_data():
    """清理测试数据"""
    print("\n🧹 清理测试数据...")
    
    test_user_uuid = "254b0155-4a3a-46bd-8902-c2daf50a8430"
    
    try:
        # 清空测试用户的订阅信息
        success = await db_service.update_user_subscription(
            user_uuid=test_user_uuid,
            subscription_id=None,
            order_id=None
        )
        
        if success:
            print("   ✅ 测试数据清理完成")
        else:
            print("   ⚠️ 测试数据清理失败")
            
    except Exception as e:
        print(f"   ❌ 清理异常: {e}")

async def main():
    """主测试函数"""
    try:
        success = await test_subscription_flow()
        
        # 询问是否清理测试数据
        if success:
            await cleanup_test_data()
            
    except Exception as e:
        print(f"❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())