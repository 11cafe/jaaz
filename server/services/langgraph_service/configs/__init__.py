"""智能体配置模块

此模块包含所有智能体的配置定义。这些配置类用于定义智能体的行为、工具和系统提示词，
实际的智能体实例将由 AgentManager 根据这些配置创建。
"""

from .base_config import BaseAgentConfig, create_handoff_tool, ToolConfig
from .planner_config import PlannerAgentConfig
from .image_designer_config import ImageDesignerAgentConfig
from .video_designer_config import VideoDesignerAgentConfig
from .magic_agent_config import MagicIntentAgentConfig, MagicDrawAgentConfig

__all__ = [
    'BaseAgentConfig',
    'ToolConfig',
    'create_handoff_tool',
    'PlannerAgentConfig',
    'ImageDesignerAgentConfig',
    'VideoDesignerAgentConfig',
    'MagicIntentAgentConfig',
    'MagicDrawAgentConfig',
]
