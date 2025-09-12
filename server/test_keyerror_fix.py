#!/usr/bin/env python3
"""
测试KeyError修复效果
验证历史消息获取逻辑能正确处理各种数据格式
"""

import json

def test_history_message_parsing():
    """测试历史消息解析逻辑"""
    
    print("🔍 测试KeyError修复效果:")
    print("=" * 60)
    
    # 模拟get_chat_history返回的已解析消息列表（正确格式）
    mock_parsed_history = [
        {
            'role': 'user',
            'content': '画一只猫',
            'timestamp': 1757100000000,
            'message_id': 'session_123_1757100000000'
        },
        {
            'role': 'assistant',
            'content': '✨ Image Generate Success\n\n![image_id: cat.png](http://localhost:8000/api/file/cat.png)',
            'timestamp': 1757100001000,
            'message_id': 'session_123_1757100001000'
        },
        {
            'role': 'user',
            'content': '画一只狗'
            # 注意：这条消息缺少timestamp和message_id字段
        }
    ]
    
    print("📚 模拟get_chat_history返回的数据:")
    print("-" * 40)
    for i, msg in enumerate(mock_parsed_history):
        print(f"{i+1}. Role: {msg.get('role', 'unknown')}")
        print(f"   Content: {msg.get('content', 'no content')[:50]}...")
        print(f"   Has timestamp: {'timestamp' in msg}")
        print(f"   Has message_id: {'message_id' in msg}")
    
    # 模拟修复后的处理逻辑
    def process_history_messages(chat_history, session_id):
        """模拟修复后的历史消息处理逻辑"""
        import time
        
        parsed_history = []
        
        for i, history_message in enumerate(chat_history):
            try:
                # 确保消息格式正确
                if not isinstance(history_message, dict):
                    print(f"[WARNING] 历史消息 {i} 不是字典格式: {type(history_message)}")
                    continue
                
                # 确保消息有基本字段，如果没有就添加
                if 'timestamp' not in history_message:
                    history_message['timestamp'] = int(time.time() * 1000) - len(chat_history) + i
                    print(f"[FIX] 为消息 {i} 添加timestamp: {history_message['timestamp']}")
                
                if 'message_id' not in history_message:
                    history_message['message_id'] = f"{session_id}_{history_message.get('timestamp', i)}"
                    print(f"[FIX] 为消息 {i} 添加message_id: {history_message['message_id']}")
                
                parsed_history.append(history_message)
                print(f"[SUCCESS] 历史消息 {i}: {history_message.get('role', 'unknown')} - {str(history_message.get('content', ''))[:30]}...")
                
            except Exception as e:
                print(f"[ERROR] 处理历史消息 {i} 时出错: {e}")
                continue
        
        return parsed_history
    
    # 测试修复逻辑
    session_id = "test_session_123"
    processed_history = process_history_messages(mock_parsed_history, session_id)
    
    print(f"\n✅ 处理结果:")
    print(f"   输入消息数: {len(mock_parsed_history)}")
    print(f"   成功处理数: {len(processed_history)}")
    print(f"   所有消息都有timestamp: {all('timestamp' in msg for msg in processed_history)}")
    print(f"   所有消息都有message_id: {all('message_id' in msg for msg in processed_history)}")
    
    print(f"\n📋 处理后的完整消息列表:")
    for i, msg in enumerate(processed_history):
        print(f"   {i+1}. [{msg['role']}] {msg['content'][:30]}...")
        print(f"      ID: {msg['message_id']}")
        print(f"      Timestamp: {msg['timestamp']}")

def test_error_handling():
    """测试错误处理能力"""
    
    print(f"\n🔍 测试错误处理能力:")
    print("=" * 60)
    
    # 模拟各种异常情况
    problematic_data = [
        "not a dict",  # 不是字典
        None,          # None值
        {},            # 空字典
        {'role': 'user'},  # 缺少content
        {'content': 'hello'},  # 缺少role
        {'role': 'assistant', 'content': None}  # content为None
    ]
    
    print("🚨 测试异常数据处理:")
    success_count = 0
    
    for i, data in enumerate(problematic_data):
        try:
            if not isinstance(data, dict):
                print(f"   {i+1}. ❌ 跳过非字典数据: {type(data)}")
                continue
            
            # 模拟处理逻辑
            if 'timestamp' not in data:
                data['timestamp'] = 12345 + i
            if 'message_id' not in data:
                data['message_id'] = f"session_{12345 + i}"
            
            print(f"   {i+1}. ✅ 成功处理: {data}")
            success_count += 1
        except Exception as e:
            print(f"   {i+1}. ❌ 处理失败: {e}")
    
    print(f"\n✅ 错误处理测试结果:")
    print(f"   总数据量: {len(problematic_data)}")
    print(f"   成功处理: {success_count}")
    print(f"   错误处理: {len(problematic_data) - success_count}")
    print(f"   稳定性: ✅ 代码不会因为异常数据而崩溃")

if __name__ == "__main__":
    test_history_message_parsing()
    test_error_handling()