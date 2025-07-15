from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.video_providers.jaaz_hailuo_provider import JaazHailuoProvider
from tools.video_generation.video_canvas_utils import send_video_start_notification, process_video_result


class GenerateVideoByHailuoInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    prompt_enhancer: bool = Field(
        default=False,
        description="Optional. Whether to enhance the prompt automatically. Use False by default."
    )
    resolution: str = Field(
        default="1080p",
        description="Optional. The resolution of the video. Hailuo only supports 1080p."
    )
    duration: int = Field(
        default=6,
        description="Optional. The duration of the video in seconds. Hailuo only supports 6 seconds."
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
    resolution: str = "1080p",
    duration: int = 6,
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

    try:
        # Validate parameters
        if duration != 6:
            raise ValueError("Hailuo only supports 6 seconds duration")

        if resolution != "1080p":
            raise ValueError("Hailuo only supports 1080p resolution")

        # Send start notification
        await send_video_start_notification(
            session_id,
            f"Starting Hailuo video generation..."
        )

        # Create Hailuo provider and generate video
        provider = JaazHailuoProvider()
        video_url = await provider.generate(
            prompt=prompt,
            model="hailuo-02",
            prompt_enhancer=prompt_enhancer,
            resolution=resolution,
            duration=duration,
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
