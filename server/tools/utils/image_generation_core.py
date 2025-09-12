"""
Image generation core module
Contains the main orchestration logic for image generation across different providers
"""

from typing import Optional, Dict, Any
from common import DEFAULT_PORT, BASE_URL
from tools.utils.image_utils import process_input_image
from ..image_providers.image_base_provider import ImageProviderBase

# 导入所有提供商以确保自动注册 (不要删除这些导入)
from ..image_providers.jaaz_provider import JaazImageProvider
from ..image_providers.openai_provider import OpenAIImageProvider
from ..image_providers.replicate_provider import ReplicateImageProvider
from ..image_providers.volces_provider import VolcesProvider
from ..image_providers.wavespeed_provider import WavespeedProvider
from ..image_providers.google_nano_provider import GoogleNanoImageProvider

# from ..image_providers.comfyui_provider import ComfyUIProvider
from .image_canvas_utils import (
    save_image_to_canvas,
)
from utils.url_converter import get_chat_image_url
import time

IMAGE_PROVIDERS: dict[str, ImageProviderBase] = {
    "jaaz": JaazImageProvider(),
    "openai": OpenAIImageProvider(),
    "replicate": ReplicateImageProvider(),
    "volces": VolcesProvider(),
    "wavespeed": WavespeedProvider(),
    "google_nano": GoogleNanoImageProvider()
}


async def generate_image_with_provider(
    canvas_id: str,
    session_id: str,
    provider: str,
    model: str,
    # image generator args
    prompt: str,
    aspect_ratio: str = "1:1",
    input_images: Optional[list[str]] = None,
) -> str:
    """
    通用图像生成函数，支持不同的模型和提供商

    Args:
        prompt: 图像生成提示词
        aspect_ratio: 图像长宽比
        model_name: 内部模型名称 (如 'gpt-image-1', 'imagen-4')
        model: 模型标识符 (如 'openai/gpt-image-1', 'google/imagen-4')
        tool_call_id: 工具调用ID
        config: 上下文运行配置，包含canvas_id，session_id，model_info，由langgraph注入
        input_images: 可选的输入参考图像列表

    Returns:
        str: 生成结果消息
    """

    provider_instance = IMAGE_PROVIDERS.get(provider)
    if not provider_instance:
        raise ValueError(f"Unknown provider: {provider}")

    # Process input images for the provider
    processed_input_images: list[str] | None = None
    if input_images:
        processed_input_images = []
        for image_path in input_images:
            processed_image = await process_input_image(image_path)
            if processed_image:
                processed_input_images.append(processed_image)

        print(f"Using {len(processed_input_images)} input images for generation")

    # Prepare metadata with all generation parameters
    metadata: Dict[str, Any] = {
        "prompt": prompt,
        "model": model,
        "provider": provider,
        "aspect_ratio": aspect_ratio,
        "input_images": input_images or [],
    }

    print(f"metadata: {metadata}")

    # Generate image using the selected provider
    mime_type, width, height, filename = await provider_instance.generate(
        prompt=prompt,
        model=model,
        aspect_ratio=aspect_ratio,
        input_images=processed_input_images,
        metadata=metadata,
    )

    # 🔧 [CHAT_FIX_V2] 保留画布保存逻辑 + 直接发送到画布
    # Save image to canvas
    image_url = await save_image_to_canvas(
        session_id, canvas_id, filename, mime_type, width, height
    )

    # 📝 [CHAT_DEBUG] 记录图片生成核心信息
    logger.info(f"🖼️ [CHAT_DEBUG] 图片生成核心完成: filename={filename}")
    logger.info(f"🖼️ [CHAT_DEBUG] 图片尺寸: {width}x{height}")
    logger.info(f"🖼️ [CHAT_DEBUG] MIME类型: {mime_type}")
    logger.info(f"🖼️ [CHAT_DEBUG] 画布URL: {image_url}")

    # 🆕 [CHAT_DUAL_DISPLAY] 实现聊天+画布双重显示
    # 聊天中显示图片，画布中显示完整图片元素
    
    # 构建聊天显示URL - 优先使用腾讯云直链
    chat_image_url = get_chat_image_url(filename)
    
    logger.info(f"🖼️ [CHAT_DUAL_DISPLAY] 图片生成核心双重显示:")
    logger.info(f"   📱 聊天显示URL: {chat_image_url}")
    logger.info(f"   🎨 画布已通过save_image_to_canvas显示")
    
    # 聊天响应包含图片预览 + 提示文本
    return f"🎨 图片已生成并添加到画布\n\n![{filename}]({chat_image_url})"
