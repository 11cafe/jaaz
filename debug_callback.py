#!/usr/bin/env python3

import asyncio
import sys
import os

# 添加server目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'server'))

from services.db_service import db_service

async def debug_callback_logic():
    """直接测试回调中的产品查找逻辑"""
    
    product_id = "prod_24vhA7mt8RYKfTdLvU1oRd"  # 来自回调的产品ID（实际是sku）
    
    print(f"🔍 调试回调产品查找逻辑")
    print(f"🎯 测试product_id: {product_id}")
    
    try:
        # 测试新的查找逻辑
        print("\n1️⃣ 尝试根据SKU查找...")
        product_by_sku = await db_service.get_product_by_sku(product_id)
        print(f"   结果: {product_by_sku}")
        
        if not product_by_sku:
            print("\n2️⃣ SKU查找失败，尝试根据product_id查找...")
            product_by_id = await db_service.get_product_by_id(product_id)
            print(f"   结果: {product_by_id}")
            
            if not product_by_id:
                print("\n❌ 两种方法都找不到产品！")
                return False
            else:
                print(f"\n✅ 通过product_id找到产品: {product_by_id['name']}")
                return True
        else:
            print(f"\n✅ 通过SKU找到产品: {product_by_sku['name']}")
            return True
        
    except Exception as e:
        print(f"❌ 查找异常: {e}")
        import traceback
        traceback.print_exc()
        return False

async def debug_order_lookup():
    """调试订单查找"""
    
    checkout_id = "ch_6Z2M36nuCLQTE1FNBN5ipp"
    creem_order_id = "ord_rqmCnQm9zRwDcAn2EtMXc"
    
    print(f"\n🔍 调试订单查找逻辑")
    print(f"🎯 checkout_id: {checkout_id}")
    print(f"🎯 creem_order_id: {creem_order_id}")
    
    try:
        # 先尝试根据creem_order_id查找
        order_by_creem_id = await db_service.get_order_by_creem_order_id(creem_order_id)
        print(f"1️⃣ 根据creem_order_id查找: {order_by_creem_id}")
        
        # 再尝试根据checkout_id查找
        order_by_checkout_id = await db_service.get_order_by_checkout_id(checkout_id)
        print(f"2️⃣ 根据checkout_id查找: {order_by_checkout_id}")
        
        return order_by_creem_id or order_by_checkout_id
        
    except Exception as e:
        print(f"❌ 查找订单异常: {e}")
        import traceback
        traceback.print_exc()
        return None

async def main():
    """主测试函数"""
    print("🧪 开始调试回调处理逻辑...\n")
    
    # 测试订单查找
    order = await debug_order_lookup()
    if order:
        print(f"✅ 找到订单: ID={order['id']}, status={order['status']}")
    else:
        print("❌ 订单查找失败")
        return
    
    # 测试产品查找
    product_found = await debug_callback_logic()
    
    if product_found:
        print("\n🎉 回调逻辑调试成功！")
    else:
        print("\n❌ 回调逻辑调试失败！")

if __name__ == "__main__":
    asyncio.run(main())