from typing import Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from tools.utils.image_generation_core import generate_image_with_provider


class EditImageByDoubaoSeedream3InputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image edit. Please describe what you want to edit in the prompt."
    )
    image: list[str] = Field(
        description="Required. The image for image generation. Pass a list of image_id here (Only 1 image supported. If you want to generate multiple images. Call another), e.g. ['im_hfuiut78.png']. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool(
    "edit_image_by_doubao_seededit_3_volces",
    description="Edit an image by Doubao Seedream 3 model using text prompt and an image. Use this model for high-quality image modification with Doubao's advanced AI.",
    args_schema=EditImageByDoubaoSeedream3InputSchema,
)
async def edit_image_by_doubao_seededit_3_volces(
    prompt: str,
    image: list[str],
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> str:
    """
    Generate an image using Doubao Seedream 3 model via the provider framework
    """
    ctx = config.get("configurable", {})
    canvas_id = ctx.get("canvas_id", "")
    session_id = ctx.get("session_id", "")

    return await generate_image_with_provider(
        canvas_id=canvas_id,
        session_id=session_id,
        provider="volces",
        model="doubao-seededit-3-0-i2i-250628",
        prompt=prompt,
        input_images=image,
    )


# Export the tool for easy import
__all__ = ["edit_image_by_doubao_seededit_3_volces"]
