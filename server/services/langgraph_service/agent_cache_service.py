"""Agent缓存服务 - 优化agent创建性能"""

import hashlib
import json
from typing import List, Dict, Any, Optional, Tuple
from langgraph.graph.graph import CompiledGraph
from models.tool_model import ToolInfoJson
from models.config_model import ModelInfo
from .agent_manager import AgentManager
from log import get_logger

logger = get_logger(__name__)


class AgentCacheService:
    """Agent缓存服务 - 缓存已创建的agents避免重复创建"""
    
    _cache: Dict[str, Tuple[List[CompiledGraph], List[str]]] = {}
    _model_cache: Dict[str, Any] = {}
    
    @classmethod
    def _generate_cache_key(
        cls,
        text_model: ModelInfo,
        tool_list: List[ToolInfoJson],
        system_prompt: str,
        template_prompt: str
    ) -> str:
        """生成缓存键"""
        cache_data = {
            'text_model': text_model,
            'tool_list': sorted(tool_list, key=lambda x: x.get('id', '')),
            'system_prompt': system_prompt,
            'template_prompt': template_prompt
        }
        cache_str = json.dumps(cache_data, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(cache_str.encode()).hexdigest()
    
    @classmethod
    def _generate_model_cache_key(cls, text_model: ModelInfo) -> str:
        """生成模型缓存键"""
        model_data = {
            'model': text_model.get('model'),
            'provider': text_model.get('provider'),
            'url': text_model.get('url')
        }
        model_str = json.dumps(model_data, sort_keys=True)
        return hashlib.md5(model_str.encode()).hexdigest()
    
    @classmethod
    def get_cached_agents(
        cls,
        text_model: ModelInfo,
        tool_list: List[ToolInfoJson],
        system_prompt: str = "",
        template_prompt: str = ""
    ) -> Optional[Tuple[List[CompiledGraph], List[str]]]:
        """获取缓存的agents"""
        cache_key = cls._generate_cache_key(text_model, tool_list, system_prompt, template_prompt)
        
        if cache_key in cls._cache:
            logger.info(f"[debug] Agent缓存命中，key: {cache_key[:8]}...")
            return cls._cache[cache_key]
        
        logger.info(f"[debug] Agent缓存未命中，key: {cache_key[:8]}...")
        return None
    
    @classmethod
    def cache_agents(
        cls,
        text_model: ModelInfo,
        tool_list: List[ToolInfoJson],
        agents: List[CompiledGraph],
        agent_names: List[str],
        system_prompt: str = "",
        template_prompt: str = ""
    ) -> None:
        """缓存agents"""
        cache_key = cls._generate_cache_key(text_model, tool_list, system_prompt, template_prompt)
        cls._cache[cache_key] = (agents, agent_names)
        logger.info(f"[debug] Agent已缓存，key: {cache_key[:8]}..., agents数量: {len(agents)}")
        
        # 限制缓存大小，避免内存过度使用
        if len(cls._cache) > 50:
            # 删除最旧的缓存项
            oldest_key = next(iter(cls._cache))
            del cls._cache[oldest_key]
            logger.info(f"[debug] 缓存已满，删除最旧项: {oldest_key[:8]}...")
    
    @classmethod
    def get_cached_model(cls, text_model: ModelInfo) -> Optional[Any]:
        """获取缓存的模型实例"""
        model_key = cls._generate_model_cache_key(text_model)
        
        if model_key in cls._model_cache:
            logger.info(f"[debug] 模型缓存命中，key: {model_key[:8]}...")
            return cls._model_cache[model_key]
        
        logger.info(f"[debug] 模型缓存未命中，key: {model_key[:8]}...")
        return None
    
    @classmethod
    def cache_model(cls, text_model: ModelInfo, model_instance: Any) -> None:
        """缓存模型实例"""
        model_key = cls._generate_model_cache_key(text_model)
        cls._model_cache[model_key] = model_instance
        logger.info(f"[debug] 模型已缓存，key: {model_key[:8]}...")
        
        # 限制模型缓存大小
        if len(cls._model_cache) > 10:
            oldest_key = next(iter(cls._model_cache))
            del cls._model_cache[oldest_key]
            logger.info(f"[debug] 模型缓存已满，删除最旧项: {oldest_key[:8]}...")
    
    @classmethod
    def clear_cache(cls) -> None:
        """清空缓存"""
        cls._cache.clear()
        cls._model_cache.clear()
        logger.info("[debug] Agent缓存已清空")
    
    @classmethod
    def get_cache_stats(cls) -> Dict[str, int]:
        """获取缓存统计信息"""
        return {
            'agent_cache_size': len(cls._cache),
            'model_cache_size': len(cls._model_cache)
        }