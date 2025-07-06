from typing import Optional
import os
import traceback
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
from openai import OpenAI


class OpenAIGenerator(ImageGenerator):
    """OpenAI image generator implementation"""

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> tuple[str, int, int, str]:
        try:
            api_key = config_service.app_config.get(
                'openai', {}).get('api_key', '')
            url = config_service.app_config.get('openai', {}).get('url', '')
            model = model.replace('openai/', '')

            client = OpenAI(api_key=api_key, base_url=url)

            if input_image:
                # input_image should be the file path for OpenAI
                with open(input_image, 'rb') as image_file:
                    result = client.images.edit(
                        model=model,
                        image=[image_file],
                        prompt=prompt,
                        n=kwargs.get("num_images", 1)
                    )
            else:
                result = client.images.generate(
                    model=model,
                    prompt=prompt,
                    n=kwargs.get("num_images", 1),
                    size=kwargs.get("size", "auto"),
                )

            image_data = result.data[0]
            if hasattr(image_data, 'b64_json') and image_data.b64_json:
                image_content = image_data.b64_json
                is_b64 = True
            elif hasattr(image_data, 'url') and image_data.url:
                image_content = image_data.url
                is_b64 = False
            else:
                raise ValueError('No valid image data found in response')

            image_id = generate_image_id()
            mime_type, width, height, extension = await get_image_info_and_save(
                image_content, os.path.join(FILES_DIR, f'{image_id}'), is_b64=is_b64
            )
            filename = f'{image_id}.{extension}'
            return mime_type, width, height, filename

        except Exception as e:
            print('Error generating image with OpenAI:', e)
            traceback.print_exc()
            raise e
