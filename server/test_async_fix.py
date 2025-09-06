#!/usr/bin/env python3
"""
测试异步修复后的 GPT 图片生成功能
"""

import asyncio
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.new_chat.tuzi_llm_service import TuziLLMService

async def test_gpt_image_generation():
    """测试 GPT 图片生成是否正常工作且不阻塞"""
    try:
        # 创建服务实例
        service = TuziLLMService()
        
        # 模拟用户信息
        user_info = {
            'email': 'test@example.com',
            'uuid': 'test-uuid-123'
        }
        
        print("🚀 开始测试 GPT 图片生成...")
        print("📝 提示词: 'draw a cat'")
        
        # 调用 gpt_by_tuzi 方法
        result = await service.gpt_by_tuzi(
            prompt="draw a cat",
            model="gpt-4o",
            user_info=user_info
        )
        
        if result:
            print("✅ 测试成功!")
            print(f"📤 返回结果: {result[:100]}...")
        else:
            print("❌ 测试失败: 没有返回结果")
            
    except Exception as e:
        print(f"❌ 测试出错: {e}")

if __name__ == "__main__":
    print("🔧 测试异步修复效果...")
    asyncio.run(test_gpt_image_generation())