from typing import Annotated, List, Dict, Any
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId  # type: ignore
from langchain_core.runnables import RunnableConfig
from services.jaaz_service import JaazService
from tools.utils.image_canvas_utils import save_image_to_canvas, send_image_start_notification, send_image_error_notification
from common import DEFAULT_PORT, BASE_URL
import os
from tools.utils.image_utils import get_image_info_and_save, generate_image_id, process_input_image
from services.config_service import FILES_DIR


class GenerateImageByMidjourneyInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. Describe what you want to see in the image."
    )
    input_images: List[str] | None = Field(
        default=None,
        description="Optional. A list of image URLs to use as input for the image generation. If provided, the images will be used as input for the image generation."
    )
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image_by_midjourney_jaaz",
      description="Generate high-quality images using Midjourney model. Returns multiple images and saves them to canvas. Use this for artistic and creative image generation.",
      args_schema=GenerateImageByMidjourneyInputSchema)
async def generate_image_by_midjourney_jaaz(
    prompt: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    input_images: List[str] | None = None,
) -> str:
    """
    Generate images using Midjourney model via Jaaz service
    """
    print(f'🎨 Midjourney Image Generation tool_call_id: {tool_call_id}')
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print(f'🎨 canvas_id {canvas_id} session_id {session_id}')

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    try:
        # Send start notification
        await send_image_start_notification(
            session_id,
            f"Starting Midjourney image generation..."
        )

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

        # Create Jaaz service and generate image
        jaaz_service = JaazService()
        result = await jaaz_service.generate_image_by_midjourney(
            prompt=prompt,
            model="midjourney",
            input_images=processed_input_images,
        )

        if not result:
            raise Exception("No result returned from Midjourney generation")

        # Process multiple images from the result
        images = result.get('images', [])
        if not images or len(images) == 0:
            raise Exception("No images found in Midjourney result")

        print(f"🎨 Midjourney generated {len(images)} images")

        # Save all images to canvas and collect results
        saved_images: List[Dict[str, Any]] = []
        for i, image_data in enumerate(images):
            try:
                image_url = image_data.get('url')
                if not image_url:
                    print(f"Warning: No URL found for image {i}")
                    continue

                # Download and save the image
                image_id = generate_image_id()
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url,
                    os.path.join(FILES_DIR, f'{image_id}'),
                    metadata={
                        "prompt": prompt,
                        "model": "midjourney",
                        "image_index": i,
                        "total_images": len(images),
                        "original_url": image_url,
                        "file_size": image_data.get('file_size'),
                        "content_type": image_data.get('content_type'),
                    }
                )

                filename = f'{image_id}.{extension}'

                # Save to canvas
                canvas_image_url = await save_image_to_canvas(
                    session_id, canvas_id, filename, mime_type, width, height
                )

                # Add to saved images list
                saved_images.append({
                    "image_id": filename,
                    "url": canvas_image_url,
                    "index": i,
                    "original_data": image_data
                })

                print(f"🎨 Saved image {i+1}/{len(images)}: {filename}")

            except Exception as e:
                print(f"Error saving image {i}: {e}")
                # Continue with other images even if one fails
                continue

        if not saved_images:
            raise Exception("Failed to save any images from Midjourney generation")

        # 📝 [CHAT_DEBUG] 记录Midjourney图片生成信息
        from log import get_logger
        logger = get_logger(__name__)
        logger.info(f"🎨 [CHAT_DEBUG] Midjourney生成了 {len(saved_images)} 张图片")
        for saved_image in saved_images:
            logger.info(f"🎨 [CHAT_DEBUG] 图片 {saved_image['index']+1}: {saved_image['image_id']} -> {BASE_URL}{saved_image['url']}")

        # 🆕 [CHAT_DUAL_DISPLAY] 实现聊天+画布双重显示
        # 为每张图片创建markdown格式，在聊天中显示
        image_links = []
        for saved_image in saved_images:
            image_url = f"{BASE_URL}{saved_image['url']}"
            image_link = f"![image_{saved_image['index']+1}: {saved_image['image_id']}]({image_url})"
            image_links.append(image_link)
        
        # 聊天响应包含图片预览 + 提示文本
        result_message = f"🎨 Midjourney已生成 {len(saved_images)} 张图片并添加到画布\n\n" + "\n\n".join(image_links)

        print(f"🎨 Midjourney generation completed: {len(saved_images)} images saved")
        return result_message

    except Exception as e:
        error_message = f"Error in Midjourney image generation: {str(e)}"
        print(f"🎨 {error_message}")

        # Send error notification
        await send_image_error_notification(session_id, error_message)

        raise e


# Export the tool for easy import
__all__ = ["generate_image_by_midjourney_jaaz"]
