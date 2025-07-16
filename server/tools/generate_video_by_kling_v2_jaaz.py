import asyncio
from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.video_providers.jaaz_kling_provider import JaazKlingProvider
from tools.video_generation.video_canvas_utils import send_video_start_notification, process_video_result
from .utils.image_utils import process_input_image


class GenerateVideoByKlingV2InputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    negative_prompt: str = Field(
        default="",
        description="Optional. Negative prompt to specify what you don't want in the video."
    )
    guidance_scale: float = Field(
        default=0.5,
        description="Optional. Guidance scale for generation (0.0 to 1.0). Higher values follow the prompt more closely."
    )
    aspect_ratio: str = Field(
        default="16:9",
        description="Optional. The aspect ratio of the video. Allowed values: 1:1, 16:9, 4:3, 21:9"
    )
    duration: int = Field(
        default=5,
        description="Optional. The duration of the video in seconds. Use 5 by default. Allowed values: 5, 10."
    )
    input_images: list[str] = Field(
        description="Required. Images to use as reference or starting frame. Pass a list of image_id here, e.g. ['im_jurheut7.png']. Only the first image will be used as start_image."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


# 全局存储等待确认的工具
pending_tool_confirmations = {}


@tool("generate_video_by_kling_v2_jaaz",
      description="Generate high-quality videos using Kling V2.1 model. Supports image-to-video generation with advanced controls like negative prompts and guidance scale.",
      args_schema=GenerateVideoByKlingV2InputSchema)
async def generate_video_by_kling_v2_jaaz(
    prompt: str,
    input_images: list[str],
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    negative_prompt: str = "",
    guidance_scale: float = 0.5,
    aspect_ratio: str = "16:9",
    duration: int = 5,
) -> str:
    """
    Generate a video using Kling V2.1 model via Jaaz Kling provider
    """
    print(f'🛠️ Kling Video Generation tool_call_id: {tool_call_id}')
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print(f'🛠️ canvas_id {canvas_id} session_id {session_id}')

    # 创建确认事件
    confirmation_event = asyncio.Event()
    pending_tool_confirmations[tool_call_id] = confirmation_event

    try:
        # 发送确认请求
        from services.websocket_service import send_to_websocket
        await send_to_websocket(session_id, {
            'type': 'tool_call_pending_confirmation',
            'id': tool_call_id,
            'name': 'generate_video_by_kling_v2_jaaz'
        })

        # 等待确认（带超时）
        try:
            await asyncio.wait_for(confirmation_event.wait(), timeout=60)
            confirmed = True
        except asyncio.TimeoutError:
            confirmed = False
            print(f'⏰ Tool confirmation timeout for {tool_call_id}')

        if not confirmed:
            return "Video generation cancelled or timed out"

        # 用户确认后，执行视频生成
        return await _execute_video_generation(
            session_id=session_id,
            canvas_id=canvas_id,
            prompt=prompt,
            input_images=input_images,
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            aspect_ratio=aspect_ratio,
            duration=duration
        )

    finally:
        # 清理确认事件
        pending_tool_confirmations.pop(tool_call_id, None)


async def _execute_video_generation(
    session_id: str,
    canvas_id: str,
    prompt: str,
    input_images: list[str],
    negative_prompt: str = "",
    guidance_scale: float = 0.5,
    aspect_ratio: str = "16:9",
    duration: int = 5,
) -> str:
    """
    Execute the actual video generation logic
    """
    try:
        # Validate input_images is provided and not empty
        if not input_images or len(input_images) == 0:
            raise ValueError(
                "input_images is required and cannot be empty. Please provide at least one image.")

        # Send start notification
        await send_video_start_notification(
            session_id,
            f"Starting Kling video generation..."
        )

        # Process input images (use first image as start_image)
        first_image = input_images[0]
        processed_image = await process_input_image(first_image)
        if not processed_image:
            raise ValueError(
                f"Failed to process input image: {first_image}. Please check if the image exists and is valid.")

        processed_start_image = processed_image
        print(
            f"Using first input image as start image for Kling video generation: {first_image}")

        # Create Kling provider and generate video
        provider = JaazKlingProvider()
        video_url = await provider.generate(
            prompt=prompt,
            model="kling-v2.1-standard",
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            aspect_ratio=aspect_ratio,
            duration=duration,
            start_image=processed_start_image,
        )

        # Process video result (save, update canvas, notify)
        return await process_video_result(
            video_url=video_url,
            session_id=session_id,
            canvas_id=canvas_id,
            provider_name="jaaz_kling",
        )

    except Exception as e:
        print(f"Error in Kling video generation: {e}")
        raise e


# 提供设置确认状态的函数
def set_tool_confirmation(tool_call_id: str, confirmed: bool) -> None:
    """
    Set the confirmation status for a tool call
    """
    if tool_call_id in pending_tool_confirmations:
        event = pending_tool_confirmations[tool_call_id]
        if confirmed:
            event.set()
        else:
            # 对于取消的情况，我们也设置事件，但标记为取消
            event.set()


# Export the tool for easy import
__all__ = ["generate_video_by_kling_v2_jaaz", "set_tool_confirmation"]
