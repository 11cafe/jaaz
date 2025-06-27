from typing import Optional
import os
import traceback
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
from openai import OpenAI

# Ensure environment variables are loaded
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not available, environment variables should be set externally


class OpenAIGenerator(ImageGenerator):
    """OpenAI image generator implementation"""

    def _get_api_key(self):
        """Get API key from configuration or environment variable"""
        # First try to get from user configuration
        config_key = config_service.app_config.get('openai', {}).get('api_key', '')
        if config_key:
            return config_key
        
        # Fallback to environment variable
        env_key = os.environ.get('OPENAI_API_KEY', '')
        if env_key:
            return env_key
            
        return ''

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> tuple[str, int, int, str]:
        try:
            api_key = self._get_api_key()
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

            image_b64 = result.data[0].b64_json
            image_id = generate_image_id()
            mime_type, width, height, extension = await get_image_info_and_save(
                image_b64, os.path.join(FILES_DIR, f'{image_id}'), is_b64=True
            )
            filename = f'{image_id}.{extension}'
            return mime_type, width, height, filename

        except Exception as e:
            print('Error generating image with OpenAI:', e)
            traceback.print_exc()
            raise e
