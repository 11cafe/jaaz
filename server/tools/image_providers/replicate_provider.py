import os
import traceback
from typing import Optional, Any
from .image_base_provider import ImageProviderBase
from ..utils.image_utils import get_image_info_and_save, generate_image_id
from services.config_service import FILES_DIR
from utils.http_client import HttpClient
from services.config_service import config_service


class ReplicateImageProvider(ImageProviderBase):
    """Replicate image generation provider implementation"""

    def _build_url(self, model: str) -> str:
        """Build request URL for Replicate API"""
        return f"https://api.replicate.com/v1/models/{model}/predictions"

    def _build_headers(self) -> dict[str, str]:
        """Build request headers"""
        config = config_service.app_config.get('replicate', {})
        api_key = config.get("api_key", "")

        if not api_key:
            raise ValueError("Replicate API key is not configured")
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "wait"
        }

    async def _make_request(self, url: str, headers: dict[str, str], data: dict[str, Any]) -> dict[str, Any]:
        """
        Send HTTP request and handle response

        Returns:
            dict[str, Any]: Response data from Replicate API
        """
        async with HttpClient.create_aiohttp() as session:
            print(
                f'🦄 Replicate API request: {url}, model: {data["input"]["prompt"]}')
            async with session.post(url, headers=headers, json=data) as response:
                # Parse JSON data
                json_data = await response.json()
                print('🦄 Replicate API response', json_data)

                return json_data

    async def _process_response(self, res: dict[str, Any]) -> tuple[str, int, int, str]:
        """
        Process Replicate API response and save image

        Args:
            res: Response data from Replicate API

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        output = res.get('output', '')
        if output == '':
            if res.get('detail', '') != '':
                raise Exception(
                    f'Replicate image generation failed: {res.get("detail", "")}')
            else:
                raise Exception(
                    'Replicate image generation failed: no output url found')

        image_id = generate_image_id()
        print('🦄 image generation image_id', image_id)

        # Get image dimensions and save
        mime_type, width, height, extension = await get_image_info_and_save(
            output, os.path.join(FILES_DIR, f'{image_id}')
        )

        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """
        Generate image using Replicate API

        Args:
            prompt: Image generation prompt
            model: Model name to use for generation
            aspect_ratio: Image aspect ratio (1:1, 16:9, 4:3, 3:4, 9:16)
            input_images: Optional input images for reference or editing
            **kwargs: Additional provider-specific parameters

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        try:
            url = self._build_url(model)
            headers = self._build_headers()

            # Build request data
            data = {
                "input": {
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                }
            }

            if input_images:
                # For Replicate format, we take the first image as input_image
                data['input']['input_image'] = input_images[0]
                if len(input_images) > 1:
                    print(
                        "Warning: Replicate format only supports single image input. Using first image.")

            # Make request
            res = await self._make_request(url, headers, data)

            # Process response and return result
            return await self._process_response(res)

        except Exception as e:
            print('Error generating image with Replicate:', e)
            traceback.print_exc()
            raise e
