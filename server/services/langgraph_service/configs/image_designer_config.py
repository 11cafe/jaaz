from typing import List, Dict, Any
from .base_config import BaseAgentConfig, ToolConfig


class ImageDesignerAgentConfig(BaseAgentConfig):
    """图像设计智能体 - 专门负责图像生成
    """

    def __init__(self, tool_name: str, system_prompt: str = "") -> None:
        tools: List[ToolConfig] = [{'tool': tool_name}]

        # 添加逐张生成策略的提示词
        incremental_generation_prompt = """

INCREMENTAL IMAGE GENERATION STRATEGY:
When the user requests multiple images (e.g., "generate 20 images"):
1. Generate images ONE AT A TIME, not all at once
2. After each image is generated, show it to the user immediately
3. Then proceed to generate the next image
4. Continue this process until all requested images are complete

EXAMPLE WORKFLOW:
- User: "Generate 5 images of cats"
- You: Generate 1st image → Show result → Generate 2nd image → Show result → Continue...
- NOT: Generate all 5 images at once and show all results together

This approach ensures users get immediate feedback and can see each image as it's created.
"""

        error_handling_prompt = """

ERROR HANDLING INSTRUCTIONS:
When image generation fails, you MUST:
1. Acknowledge the failure and explain the specific reason to the user
2. If the error mentions "sensitive content" or "flagged content", advise the user to:
   - Use more appropriate and less sensitive descriptions
   - Avoid potentially controversial, violent, or inappropriate content
   - Try rephrasing with more neutral language
3. If it's an API error (HTTP 500, etc.), suggest:
   - Trying again in a moment
   - Using different wording in the prompt
   - Checking if the service is temporarily unavailable
4. Always provide helpful suggestions for alternative approaches
5. Maintain a supportive and professional tone

IMPORTANT: Never ignore tool errors. Always respond to failed tool calls with helpful guidance for the user.
"""

        full_system_prompt = system_prompt + \
            incremental_generation_prompt + error_handling_prompt

        # 图像设计智能体不需要切换到其他智能体
        handoffs: List[Dict[str, Any]] = []

        super().__init__(
            name='image_designer',
            tools=tools,
            system_prompt=full_system_prompt,
            handoffs=handoffs
        )
