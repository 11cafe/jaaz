import os
import asyncio
import traceback
from typing import Optional, Any
from pydantic import BaseModel
from .image_base_provider import ImageProviderBase
from ..utils.image_utils import get_image_info_and_save, generate_image_id
from services.config_service import FILES_DIR, config_service
from utils.http_client import HttpClient


class WavespeedResponse(BaseModel):
    """WaveSpeed API response format"""
    code: int
    data: dict[str, Any]
    message: Optional[str] = None


class WavespeedProvider(ImageProviderBase):
    """WaveSpeed image generation provider implementation"""

    def _build_headers(self) -> dict[str, str]:
        """Build request headers"""
        config = config_service.app_config.get('wavespeed', {})
        api_key = str(config.get("api_key", ""))
        api_url = str(config.get("url", ""))
        channel = os.environ.get('WAVESPEED_CHANNEL', 'jaaz_main')

        if not api_key:
            raise ValueError("WaveSpeed API key is not configured")
        if not api_url:
            raise ValueError("WaveSpeed API URL is not configured")
        return {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'channel': channel,
        }

    def _build_payload(self, prompt: str, input_images: Optional[list[str]] = None, **kwargs: Any) -> dict[str, Any]:
        """Build request payload based on whether input images are provided"""
        if input_images and len(input_images) > 0:
            # Image editing mode
            return {
                "prompt": prompt,
                "images": input_images,
                "guidance_scale": kwargs.get("guidance_scale", 3.5),
                "num_images": kwargs.get("num_images", 1),
                "safety_tolerance": str(kwargs.get("safety_tolerance", "2"))
            }
        else:
            # Text-to-image mode
            return {
                "enable_base64_output": False,
                "enable_safety_checker": False,
                "guidance_scale": kwargs.get("guidance_scale", 3.5),
                "num_images": kwargs.get("num_images", 1),
                "num_inference_steps": kwargs.get("num_inference_steps", 28),
                "prompt": prompt,
                "seed": -1,
                "size": kwargs.get("size", "1024*1024"),
                "strength": kwargs.get("strength", 0.8),
            }

    def _get_model_for_request(self, model: str, input_images: Optional[list[str]] = None) -> str:
        """Get the appropriate model for the request"""
        if input_images and len(input_images) > 0:
            return 'wavespeed-ai/flux-kontext-pro/multi'
        return model

    async def _poll_for_result(self, result_url: str, headers: dict[str, str]) -> str:
        """Poll for image generation result"""
        async with HttpClient.create_aiohttp() as session:
            for _ in range(60):  # 最多等60秒
                await asyncio.sleep(1)
                async with session.get(result_url, headers=headers) as result_resp:
                    result_data = await result_resp.json()
                    print("WaveSpeed polling result:", result_data)

                    data = result_data.get("data", {})
                    outputs = data.get("outputs", [])
                    status = data.get("status")

                    if status in ("succeeded", "completed") and outputs:
                        return outputs[0]

                    if status == "failed":
                        raise Exception(
                            f"WaveSpeed generation failed: {result_data}")

            raise Exception("WaveSpeed image generation timeout")

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """
        Generate image using WaveSpeed API service

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
            headers = self._build_headers()
            payload = self._build_payload(prompt, input_images, **kwargs)
            request_model = self._get_model_for_request(model, input_images)

            endpoint = f"{self.api_url.rstrip('/')}/{request_model}"

            async with HttpClient.create_aiohttp() as session:
                async with session.post(endpoint, json=payload, headers=headers) as response:
                    response_json = await response.json()

                    if response.status != 200 or response_json.get("code") != 200:
                        raise Exception(
                            f"WaveSpeed API error: {response_json}")

                    result_url = response_json["data"]["urls"]["get"]

                # Poll for the result
                image_url = await self._poll_for_result(result_url, headers)

                # Save the image
                image_id = generate_image_id()
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url,
                    os.path.join(FILES_DIR, f'{image_id}')
                )
                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename

        except Exception as e:
            print('Error generating image with WaveSpeed:', e)
            traceback.print_exc()
            raise e
