from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.video_generation.video_generation_core import generate_video_with_provider
from .utils.image_utils import process_input_image
from services.tool_confirmation_manager import tool_confirmation_manager
from services.websocket_service import send_to_websocket
import json


class GenerateVideoBySeedanceV1InputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    resolution: str = Field(
        default="480p",
        description="Optional. The resolution of the video. Use 480p if not explicitly specified by user. Allowed values: 480p, 1080p."
    )
    duration: int = Field(
        default=5,
        description="Optional. The duration of the video in seconds. Use 5 by default. Allowed values: 5, 10."
    )
    aspect_ratio: str = Field(
        default="16:9",
        description="Optional. The aspect ratio of the video. Allowed values: 1:1, 16:9, 4:3, 21:9"
    )
    input_images: list[str] | None = Field(
        default=None,
        description="Optional. Images to use as reference or first frame. Pass a list of image_id here, e.g. ['im_jurheut7.png']."
    )
    camera_fixed: bool = Field(
        default=True,
        description="Optional. Whether to keep the camera fixed (no camera movement)."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_video_by_seedance_v1_pro_volces",
      description="Generate high-quality videos using Seedance V1 model. Supports multiple providers and text-to-video/image-to-video generation.",
      args_schema=GenerateVideoBySeedanceV1InputSchema)
async def generate_video_by_seedance_v1_pro_volces(
    prompt: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    resolution: str = "480p",
    duration: int = 5,
    aspect_ratio: str = "16:9",
    input_images: list[str] | None = None,
    camera_fixed: bool = True,
) -> str:
    """
    Generate a video using Seedance V1 model via configured provider
    """
    # 检查是否需要确认
    ctx = config.get('configurable', {})
    session_id = ctx.get('session_id', '')

    arguments = {
        'prompt': prompt,
        'resolution': resolution,
        'duration': duration,
        'aspect_ratio': aspect_ratio,
        'input_images': input_images,
        'camera_fixed': camera_fixed,
    }

    # 发送确认请求
    await send_to_websocket(session_id, {
        'type': 'tool_call_pending_confirmation',
        'id': tool_call_id,
        'name': 'generate_video_by_seedance_v1_pro_volces',
        'arguments': json.dumps(arguments)
    })

    # 等待确认
    confirmed = await tool_confirmation_manager.request_confirmation(
        tool_call_id, session_id, 'generate_video_by_seedance_v1_pro_volces', arguments
    )

    if not confirmed:
        return "Video generation cancelled by user."

    # Process input images if provided (only use the first one)
    processed_input_images = None
    if input_images and len(input_images) > 0:
        # Only process the first image
        first_image = input_images[0]
        processed_image = await process_input_image(first_image)
        if processed_image:
            processed_input_images = [processed_image]
            print(f"Using input image for video generation: {first_image}")
        else:
            raise ValueError(
                f"Failed to process input image: {first_image}. Please check if the image exists and is valid.")

    return await generate_video_with_provider(
        prompt=prompt,
        resolution=resolution,
        duration=duration,
        aspect_ratio=aspect_ratio,
        model="doubao-seedance-1-0-pro-250528",
        tool_call_id=tool_call_id,
        config=config,
        input_images=processed_input_images,
        camera_fixed=camera_fixed,
    )


# Export the tool for easy import
__all__ = ["generate_video_by_seedance_v1_pro_volces"]
