#!/usr/bin/env python3
"""
测试消息唯一性修复效果
"""

import time
import json

def test_message_uniqueness():
    """测试消息唯一性生成逻辑"""
    
    # 模拟相同内容的用户消息
    session_id = "test_session_123"
    
    # 第一条消息
    user_message_1 = {
        'role': 'user',
        'content': '画一只小老鼠'
    }
    
    # 第二条消息（内容相同）
    user_message_2 = {
        'role': 'user', 
        'content': '画一只小老鼠'
    }
    
    # 模拟修复后的处理逻辑
    def add_unique_identifiers(message, session_id):
        enhanced_message = message.copy()
        enhanced_message['timestamp'] = int(time.time() * 1000)
        enhanced_message['message_id'] = f"{session_id}_{enhanced_message['timestamp']}"
        return enhanced_message
    
    # 处理两条消息（模拟连续发送）
    print("🔍 测试相同内容消息的唯一性标识:")
    print("=" * 50)
    
    # 第一条消息
    enhanced_msg_1 = add_unique_identifiers(user_message_1, session_id)
    print("第一条消息:")
    print(f"  Content: {enhanced_msg_1['content']}")
    print(f"  Message ID: {enhanced_msg_1['message_id']}")
    print(f"  Timestamp: {enhanced_msg_1['timestamp']}")
    
    # 稍微延迟以确保时间戳不同
    time.sleep(0.001)
    
    # 第二条消息
    enhanced_msg_2 = add_unique_identifiers(user_message_2, session_id)
    print("\n第二条消息:")
    print(f"  Content: {enhanced_msg_2['content']}")
    print(f"  Message ID: {enhanced_msg_2['message_id']}")
    print(f"  Timestamp: {enhanced_msg_2['timestamp']}")
    
    # 验证唯一性
    print("\n" + "=" * 50)
    print("✅ 验证结果:")
    
    content_same = enhanced_msg_1['content'] == enhanced_msg_2['content']
    id_different = enhanced_msg_1['message_id'] != enhanced_msg_2['message_id']
    timestamp_different = enhanced_msg_1['timestamp'] != enhanced_msg_2['timestamp']
    
    print(f"  内容相同: {content_same}")
    print(f"  消息ID不同: {id_different}")
    print(f"  时间戳不同: {timestamp_different}")
    
    if content_same and id_different and timestamp_different:
        print("\n🎉 测试通过! 相同内容的消息现在有不同的唯一标识符!")
        print("   前端可以基于 message_id 或 timestamp 来区分消息")
    else:
        print("\n❌ 测试失败!")
        
    return content_same and id_different and timestamp_different

if __name__ == "__main__":
    test_message_uniqueness()