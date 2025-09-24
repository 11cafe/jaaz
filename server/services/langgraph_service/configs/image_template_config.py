from typing import List

from models.tool_model import ToolInfoJson
from .base_config import BaseAgentConfig, HandoffConfig

class ImageTemplaterAgentConfig(BaseAgentConfig):
    """图像模板智能体 - 专门基于图像模板生成图像
    """

    def __init__(self, tool_list: List[ToolInfoJson], system_prompt: str = "") -> None:
        # 图像设计智能体不需要切换到其他智能体
        handoffs: List[HandoffConfig] = []
        super().__init__(
            name='image_template',
            tools=tool_list,
            system_prompt="直接调用图像模板工具生成图像",
            handoffs=handoffs
        )
