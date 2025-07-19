from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.video_providers.jaaz_hailuo_provider import JaazHailuoProvider
from tools.video_generation.video_canvas_utils import send_video_start_notification, process_video_result
from .utils.image_utils import process_input_image
from services.tool_confirmation_manager import tool_confirmation_manager
from services.websocket_service import send_to_websocket
import json


class GenerateVideoByHailuoInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    prompt_enhancer: bool = Field(
        default=False,
        description="Optional. Whether to enhance the prompt automatically. Use False by default."
    )
    resolution: str = Field(
        default="768p",
        description="Optional. The resolution of the video. Use 768p by default. Allowed values: 768p, 1080p."
    )
    duration: int = Field(
        default=6,
        description="Optional. The duration of the video in seconds. Use 6 by default. Allowed values: 6, 10."
    )
    input_images: list[str] | None = Field(
        default=None,
        description="Optional. Images to use as reference or starting frame. Pass a list of image_id here, e.g. ['im_jurheut7.png']. Only the first image will be used as start_image."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_video_by_hailuo_02_jaaz",
      description="Generate high-quality videos using Hailuo 02 model. Supports text-to-video generation with prompt enhancement. Fixed 6-second duration and 1080p resolution.",
      args_schema=GenerateVideoByHailuoInputSchema)
async def generate_video_by_hailuo_02_jaaz(
    prompt: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    prompt_enhancer: bool = False,
    resolution: str = "768p",
    duration: int = 6,
    input_images: list[str] | None = None,
) -> str:
    """
    Generate a video using Hailuo 02 model via Jaaz Hailuo provider
    """
    print(f'🛠️ Hailuo Video Generation tool_call_id: {tool_call_id}')
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print(f'🛠️ canvas_id {canvas_id} session_id {session_id}')

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    # 检查是否需要确认
    arguments = {
        'prompt': prompt,
        'prompt_enhancer': prompt_enhancer,
        'resolution': resolution,
        'duration': duration,
        'input_images': input_images,
    }

    # 发送确认请求
    await send_to_websocket(session_id, {
        'type': 'tool_call_pending_confirmation',
        'id': tool_call_id,
        'name': 'generate_video_by_hailuo_02_jaaz',
        'arguments': json.dumps(arguments)
    })

    # 等待确认
    confirmed = await tool_confirmation_manager.request_confirmation(
        tool_call_id, session_id, 'generate_video_by_hailuo_02_jaaz', arguments
    )

    if not confirmed:
        return "Video generation cancelled by user."

    try:
        # Send start notification
        await send_video_start_notification(
            session_id,
            f"Starting Hailuo video generation..."
        )

        # Process input images if provided (only use the first one)
        input_image = ''
        if input_images and len(input_images) > 0:
            # Only process the first image
            first_image = input_images[0]
            processed_image = await process_input_image(first_image)
            if processed_image:
                input_image = processed_image
                print(f"Using input image for video generation: {first_image}")
            else:
                raise ValueError(
                    f"Failed to process input image: {first_image}. Please check if the image exists and is valid.")

        # Create Hailuo provider and generate video
        provider = JaazHailuoProvider()
        video_url = await provider.generate(
            prompt=prompt,
            model="hailuo-02",
            prompt_enhancer=prompt_enhancer,
            resolution=resolution,
            duration=duration,
            input_image=input_image,
        )

        # Process video result (save, update canvas, notify)
        return await process_video_result(
            video_url=video_url,
            session_id=session_id,
            canvas_id=canvas_id,
            provider_name="jaaz_hailuo",
        )

    except Exception as e:
        print(f"Error in Hailuo video generation: {e}")
        raise e


# Export the tool for easy import
__all__ = ["generate_video_by_hailuo_02_jaaz"]
