"""
Magic Image Generation Tool for Jaaz Provider
专门用于魔法图片生成的工具，基于 gpt-image-1 模型
"""

from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.utils.image_canvas_utils import (
    save_image_to_canvas,
)
from tools.image_providers.jaaz_provider import JaazImageProvider
from common import DEFAULT_PORT


class GenerateImageByMagicJaazInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt."
    )
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16. Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4"
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_magic_jaaz",
      description="Generate a magic image based on user's sketch using GPT Image 1 model. This tool is specifically designed for the magic image generation workflow where users provide a sketch and want it transformed into a polished, artistic image. The tool analyzes the sketch and generates an enhanced version with improved style, composition, and artistic quality. The user's original sketch is automatically retrieved from the context.",
      args_schema=GenerateImageByMagicJaazInputSchema)
async def generate_image_by_magic_jaaz(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> str:
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')

    # 从上下文中获取图片数据
    image_url = ctx.get('input_image_data', '')
    if not image_url:
        raise ValueError(
            "No image data found in context. Please ensure the user has provided a sketch image.")

    provider_instance = JaazImageProvider()
    model = 'openai/gpt-image-1'

    print(f"🎨 使用 jaaz 生成魔法图片: {prompt} {aspect_ratio}")

    # Generate image using the selected provider
    mime_type, width, height, filename = await provider_instance.generate(
        prompt=prompt,
        model=model,
        aspect_ratio=aspect_ratio,
        input_images=[image_url],
    )

    # Save image to canvas
    result_image_url = await save_image_to_canvas(
        session_id, canvas_id, filename, mime_type, width, height
    )

    return f"image generated successfully ![image_id: {filename}](http://localhost:{DEFAULT_PORT}{result_image_url})"

# Export the tool for easy import
__all__ = ["generate_image_by_magic_jaaz"]
