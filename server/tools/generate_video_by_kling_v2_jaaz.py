from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig


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

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    # Send confirmation request instead of immediately executing
    from services.websocket_service import send_to_websocket
    await send_to_websocket(session_id, {
        'type': 'tool_call_pending_confirmation',
        'id': tool_call_id,
        'name': 'generate_video_by_kling_v2_jaaz'
    })

    # Return a placeholder message indicating confirmation is needed
    return "Video generation pending user confirmation. Please confirm in the chat interface to proceed."


# Export the tool for easy import
__all__ = ["generate_video_by_kling_v2_jaaz"]
