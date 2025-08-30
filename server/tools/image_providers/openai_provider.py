import os
import traceback
from typing import Optional, Any
from openai import OpenAI
from .image_base_provider import ImageProviderBase
from ..utils.image_utils import get_image_info_and_save, generate_image_id
from services.config_service import FILES_DIR
from services.config_service import config_service


class OpenAIImageProvider(ImageProviderBase):
    """OpenAI image generation provider implementation"""

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """
        Generate image using OpenAI API

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """

        config = config_service.app_config.get('openai', {})
        self.api_key = str(config.get("api_key", ""))
        self.base_url = str(config.get("url", ""))  # 可选

        if not self.api_key:
            raise ValueError("OpenAI API key is not configured")

        # Create OpenAI client
        self.client = OpenAI(api_key=self.api_key,
                             base_url=self.base_url or None)
        try:
            # Remove openai/ prefix if present
            model = model.replace('openai/', '')

            # Determine if this is an edit operation or generation
            if input_images and len(input_images) > 0:
                # Image editing mode
                input_image_path = input_images[0]
                # For OpenAI, input_image should be the file path
                full_path = os.path.join(FILES_DIR, input_image_path)
                print(f"full_path: {full_path}")
                with open(full_path, 'rb') as image_file:
                    result = self.client.images.edit(
                        model=model,
                        image=image_file,
                        prompt=prompt,
                        n=kwargs.get("num_images", 1)
                    )
            else:
                # Image generation mode
                # Map aspect ratio to size
                size_map = {
                    "1:1": "1024x1024",
                    "16:9": "1792x1024",
                    "9:16": "1024x1792",
                    "4:3": "1024x768",
                    "3:4": "768x1024"
                }
                size = size_map.get(aspect_ratio, "1024x1024")

                print(f"prompt: {prompt}")
                result = self.client.images.generate(
                    model=model,
                    prompt=prompt,
                    n=kwargs.get("num_images", 1),
                    size=size,
                )

            # Process the result
            if not result.data or len(result.data) == 0:
                raise Exception("No image data returned from OpenAI API")

            image_data = result.data[0]

            # Handle different response formats
            if hasattr(image_data, 'b64_json') and image_data.b64_json:
                # Base64 response
                image_b64 = image_data.b64_json
                image_id = generate_image_id()
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_b64, os.path.join(FILES_DIR, f'{image_id}'), is_b64=True
                )
            elif hasattr(image_data, 'url') and image_data.url:
                # URL response
                image_url = image_data.url
                image_id = generate_image_id()
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url, os.path.join(FILES_DIR, f'{image_id}')
                )
            else:
                raise Exception("Invalid response format from OpenAI API")

            # Ensure mime_type is not None
            if mime_type is None:
                raise Exception('Failed to determine image MIME type')

            filename = f'{image_id}.{extension}'
            return mime_type, width, height, filename

        except Exception as e:
            print('Error generating image with OpenAI:', e)
            traceback.print_exc()
            raise e
