from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from .video_generation import generate_video_with_provider
from .utils.image_utils import process_input_image


class GenerateVideoBySeedanceV1LiteInputI2VSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    resolution: str = Field(
        default="480p",
        description="Optional. The resolution of the video. Use 480p if not explicitly specified by user. Allowed values: 480p, 720p."
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
        description="Optional. Images to use as reference or first frame and last frame. Pass a list of image_id here **in order**, e.g. ['im_jurheut7.png']."
    )
    camera_fixed: bool = Field(
        default=True,
        description="Optional. Whether to keep the camera fixed (no camera movement)."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


class GenerateVideoBySeedanceV1LiteInputT2VSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation. Describe what you want to see in the video."
    )
    resolution: str = Field(
        default="480p",
        description="Optional. The resolution of the video. Use 480p if not explicitly specified by user. Allowed values: 480p, 720p."
    )
    duration: int = Field(
        default=5,
        description="Optional. The duration of the video in seconds. Use 5 by default. Allowed values: 5, 10."
    )
    aspect_ratio: str = Field(
        default="16:9",
        description="Optional. The aspect ratio of the video. Allowed values: 1:1, 16:9, 4:3, 21:9"
    )
    camera_fixed: bool = Field(
        default=True,
        description="Optional. Whether to keep the camera fixed (no camera movement)."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]



@tool("generate_video_by_seedance_v1_lite_i2v",
      description="Generate high-quality videos using Seedance V1 Lite model. Supports image-to-video/first-last-frame-video generation.",
      args_schema=GenerateVideoBySeedanceV1LiteInputI2VSchema)
async def generate_video_by_seedance_v1_lite_i2v(
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
    if input_images is None:
        raise ValueError("Input images must be provided for image-to-video generation.")
    # Process input images if provided (only use the first one)
    processed_input_images = None
    if len(input_images) > 1:
        # first-last-frame-to-video
        first_image = input_images[0]
        last_frame = input_images[-1]
        processed_first_image = await process_input_image(first_image)
        processed_last_frame = await process_input_image(last_frame)
        if processed_first_image and processed_last_frame:
            processed_input_images = [processed_first_image, processed_last_frame]
            print(f"Using input images for video generation: {first_image}, {last_frame}")
        else:
            raise ValueError(
                f"Failed to process input image: {first_image}. Please check if the image exists and is valid.")
    else:
        # image-to-video
        processed_input_images = [await process_input_image(input_images[0])]
        print(f"Using input image for video generation: {input_images[0]}")

    return await generate_video_with_provider(
        prompt=prompt,
        resolution=resolution,
        duration=duration,
        aspect_ratio=aspect_ratio,
        model="doubao-seedance-1-0-lite-i2v-250428",
        tool_call_id=tool_call_id,
        config=config,
        input_images=processed_input_images if processed_input_images and all(img is not None for img in processed_input_images) else None,
        camera_fixed=camera_fixed,
    )

@tool("generate_video_by_seedance_v1_lite_t2v",
      description="Generate high-quality videos using Seedance V1 Lite model. Supports text-to-video generation.",
      args_schema=GenerateVideoBySeedanceV1LiteInputT2VSchema)
async def generate_video_by_seedance_v1_lite_t2v(
    prompt: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    resolution: str = "480p",
    duration: int = 5,
    aspect_ratio: str = "16:9",
    camera_fixed: bool = True,
) -> str:
    """
    Generate a video using Seedance V1 model via configured provider
    """

    return await generate_video_with_provider(
        prompt=prompt,
        resolution=resolution,
        duration=duration,
        aspect_ratio=aspect_ratio,
        model="doubao-seedance-1-0-lite-t2v-250428",
        tool_call_id=tool_call_id,
        config=config,
        camera_fixed=camera_fixed,
    )



# Export the tool for easy import
__all__ = ["generate_video_by_seedance_v1_lite_i2v", "generate_video_by_seedance_v1_lite_t2v"]

