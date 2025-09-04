"""消息处理优化服务 - 优化消息历史处理和缓存"""

import json
import time
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from log import get_logger

logger = get_logger(__name__)


class MessageOptimizationService:
    """消息处理优化服务 - 提供消息缓存、压缩和批量处理功能"""
    
    def __init__(self):
        self._message_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._processed_cache: Dict[str, Any] = {}
        self._cache_timestamps: Dict[str, float] = {}
        self._max_cache_size = 100
        self._cache_ttl = 3600  # 1小时
    
    def _generate_message_hash(self, messages: List[Dict[str, Any]]) -> str:
        """生成消息列表的哈希值"""
        # 只取消息的核心内容进行哈希，忽略时间戳等变化字段
        core_content = []
        for msg in messages:
            core_msg = {
                'role': msg.get('role'),
                'content': msg.get('content')
            }
            if msg.get('tool_calls'):
                core_msg['tool_calls'] = msg['tool_calls']
            core_content.append(core_msg)
        
        content_str = json.dumps(core_content, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(content_str.encode()).hexdigest()
    
    def _cleanup_expired_cache(self) -> None:
        """清理过期的缓存项"""
        current_time = time.time()
        expired_keys = [
            key for key, timestamp in self._cache_timestamps.items()
            if current_time - timestamp > self._cache_ttl
        ]
        
        for key in expired_keys:
            self._message_cache.pop(key, None)
            self._processed_cache.pop(key, None)
            self._cache_timestamps.pop(key, None)
        
        if expired_keys:
            logger.info(f"[debug] 清理了 {len(expired_keys)} 个过期缓存项")
    
    def cache_messages(self, session_id: str, messages: List[Dict[str, Any]]) -> None:
        """缓存消息历史"""
        start_time = time.time()
        
        # 清理过期缓存
        self._cleanup_expired_cache()
        
        # 如果缓存过大，删除最旧的项
        if len(self._message_cache) >= self._max_cache_size:
            oldest_key = min(self._cache_timestamps.keys(), key=self._cache_timestamps.get)
            self._message_cache.pop(oldest_key, None)
            self._processed_cache.pop(oldest_key, None)
            self._cache_timestamps.pop(oldest_key, None)
            logger.info(f"[debug] 缓存已满，删除最旧项: {oldest_key[:8]}...")
        
        self._message_cache[session_id] = messages.copy()
        self._cache_timestamps[session_id] = time.time()
        
        logger.info(f"[debug] 缓存消息历史，session: {session_id[:8]}..., 消息数: {len(messages)}, 耗时: {(time.time() - start_time) * 1000:.2f}ms")
    
    def get_cached_messages(self, session_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取缓存的消息历史"""
        self._cleanup_expired_cache()
        
        if session_id in self._message_cache:
            logger.info(f"[debug] 消息缓存命中: {session_id[:8]}...")
            return self._message_cache[session_id].copy()
        
        logger.info(f"[debug] 消息缓存未命中: {session_id[:8]}...")
        return None
    
    def compress_message_content(self, content: Any) -> Any:
        """压缩消息内容（移除不必要的字段）"""
        if isinstance(content, str):
            # 文本内容保持不变
            return content
        elif isinstance(content, list):
            # 处理混合内容
            compressed_content = []
            for item in content:
                if isinstance(item, dict):
                    if item.get('type') == 'text':
                        compressed_content.append({
                            'type': 'text',
                            'text': item.get('text', '')
                        })
                    elif item.get('type') == 'image_url':
                        # 保留图片URL，但可以考虑压缩
                        compressed_content.append({
                            'type': 'image_url',
                            'image_url': item.get('image_url', {})
                        })
                    else:
                        compressed_content.append(item)
                else:
                    compressed_content.append(item)
            return compressed_content
        else:
            return content
    
    def optimize_message_history(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """优化消息历史（压缩、去重等）"""
        start_time = time.time()
        
        optimized_messages = []
        seen_contents = set()
        
        for msg in messages:
            # 压缩消息内容
            optimized_msg = msg.copy()
            optimized_msg['content'] = self.compress_message_content(msg.get('content'))
            
            # 简单去重（基于内容哈希）
            if isinstance(optimized_msg['content'], str):
                content_hash = hashlib.md5(optimized_msg['content'].encode()).hexdigest()
                if content_hash not in seen_contents:
                    seen_contents.add(content_hash)
                    optimized_messages.append(optimized_msg)
            else:
                # 复杂内容直接保留
                optimized_messages.append(optimized_msg)
        
        logger.info(f"[debug] 消息历史优化完成，原始: {len(messages)}, 优化后: {len(optimized_messages)}, 耗时: {(time.time() - start_time) * 1000:.2f}ms")
        return optimized_messages
    
    def batch_process_messages(self, message_batches: List[List[Dict[str, Any]]]) -> List[List[Dict[str, Any]]]:
        """批量处理多个消息列表"""
        start_time = time.time()
        
        processed_batches = []
        for batch in message_batches:
            processed_batch = self.optimize_message_history(batch)
            processed_batches.append(processed_batch)
        
        logger.info(f"[debug] 批量处理 {len(message_batches)} 个消息列表，耗时: {(time.time() - start_time) * 1000:.2f}ms")
        return processed_batches
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        current_time = time.time()
        active_caches = sum(1 for timestamp in self._cache_timestamps.values() 
                           if current_time - timestamp <= self._cache_ttl)
        
        return {
            'total_cached_sessions': len(self._message_cache),
            'active_cached_sessions': active_caches,
            'cache_hit_potential': active_caches / max(len(self._message_cache), 1),
            'max_cache_size': self._max_cache_size,
            'cache_ttl': self._cache_ttl
        }
    
    def clear_cache(self) -> None:
        """清空所有缓存"""
        self._message_cache.clear()
        self._processed_cache.clear()
        self._cache_timestamps.clear()
        logger.info("[debug] 消息缓存已清空")


# 全局实例
message_optimization_service = MessageOptimizationService()