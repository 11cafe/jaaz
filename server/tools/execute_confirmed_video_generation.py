from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.video_providers.jaaz_kling_provider import JaazKlingProvider
from tools.video_generation.video_canvas_utils import send_video_start_notification, process_video_result
from .utils.image_utils import process_input_image


class ExecuteConfirmedVideoGenerationInputSchema(BaseModel):
    tool_call_id: str = Field(description="The tool call ID to execute")
    prompt: str = Field(description="The prompt for video generation")
    negative_prompt: str = Field(default="", description="Negative prompt")
    guidance_scale: float = Field(default=0.5, description="Guidance scale")
    aspect_ratio: str = Field(default="16:9", description="Aspect ratio")
    duration: int = Field(default=5, description="Duration in seconds")
    input_images: list[str] = Field(description="Input images")


@tool("execute_confirmed_video_generation",
      description="Execute video generation after user confirmation",
      args_schema=ExecuteConfirmedVideoGenerationInputSchema)
async def execute_confirmed_video_generation(
    tool_call_id: str,
    prompt: str,
    input_images: list[str],
    config: RunnableConfig,
    negative_prompt: str = "",
    guidance_scale: float = 0.5,
    aspect_ratio: str = "16:9",
    duration: int = 5,
) -> str:
    """
    Execute video generation after user confirmation
    """
    print(
        f'🛠️ Executing confirmed video generation for tool_call_id: {tool_call_id}')
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')

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
        print(f"Error in confirmed video generation: {e}")
        raise e


# Export the tool for easy import
__all__ = ["execute_confirmed_video_generation"]
