import os
import traceback
import asyncio
from typing import Optional, List, Any, Dict
from pydantic import BaseModel
from openai.types import Image
from .image_base_provider import ImageProviderBase
from ..utils.image_utils import get_image_info_and_save, generate_image_id
from services.config_service import FILES_DIR
from utils.http_client import HttpClient
from services.config_service import config_service


class JaazImagesResponse(BaseModel):
    """Image response class, Jaaz API return format, consistent with OpenAI"""
    created: int
    """The Unix timestamp (in seconds) of when the image was created."""

    data: Optional[List[Image]] = None
    """The list of generated images."""


class TaskSearchResponse(BaseModel):
    """Task search response model"""
    success: bool
    data: Dict[str, Any]


class JaazImageProvider(ImageProviderBase):
    """Jaaz Cloud image generation provider implementation"""

    def _build_url(self) -> str:
        """Build request URL"""
        config = config_service.app_config.get('jaaz', {})
        api_url = str(config.get("url", "")).rstrip("/")
        api_token = str(config.get("api_key", ""))

        if not api_url:
            raise ValueError("Jaaz API URL is not configured")
        if not api_token:
            raise ValueError("Jaaz API token is not configured")
        if api_url.rstrip('/').endswith('/api/v1'):
            return f"{api_url.rstrip('/')}/image/generations"
        else:
            return f"{api_url.rstrip('/')}/api/v1/image/generations"

    def _build_search_url(self) -> str:
        """Build task search URL"""
        config = config_service.app_config.get('jaaz', {})
        api_url = str(config.get("url", "")).rstrip("/")

        if api_url.rstrip('/').endswith('/api/v1'):
            return f"{api_url.rstrip('/')}/task/search"
        else:
            return f"{api_url.rstrip('/')}/api/v1/task/search"

    def _build_headers(self) -> Dict[str, str]:
        config = config_service.app_config.get('jaaz', {})
        api_token = str(config.get("api_key", ""))

        """Build request headers"""
        return {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    async def _search_cloud_task(self, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Search for existing cloud task

        Args:
            prompt: The generation prompt

        Returns:
            Task data if found and succeeded, None otherwise
        """
        try:
            url = self._build_search_url()
            headers = self._build_headers()

            search_data = {
                "prompt": prompt,
                "type": 'image',
            }

            async with HttpClient.create_aiohttp() as session:
                async with session.post(url, headers=headers, json=search_data) as response:
                    if response.status != 200:
                        print(f'🦄 Task search failed: HTTP {response.status}')
                        return None

                    json_data = await response.json()
                    if json_data.get('success') and json_data.get('data', {}).get('found'):
                        task = json_data['data']['task']
                        print(
                            f'🦄 Found cloud task: {task.get("id")}, status: {task.get("status")}')
                        return task

                    return None

        except Exception as e:
            print(f'🦄 Error searching cloud task: {e}')
            return None

    async def _wait_for_task_completion(self, prompt: str, max_wait_time: int = 300) -> Optional[Dict[str, Any]]:
        """
        Wait for cloud task to complete

        Args:
            prompt: The generation prompt
            model: The model used
            max_wait_time: Maximum wait time in seconds

        Returns:
            Task data if succeeded, None otherwise
        """
        start_time = asyncio.get_event_loop().time()
        no_task_retry_count = 0
        max_no_task_retries = 5

        while True:
            task = await self._search_cloud_task(prompt)

            if not task:
                no_task_retry_count += 1
                if no_task_retry_count <= max_no_task_retries:
                    print(
                        f'🦄 No cloud task found, retrying ({no_task_retry_count}/{max_no_task_retries})...')
                    await asyncio.sleep(3)
                    continue
                else:
                    print('🦄 No cloud task found after 5 retries')
                    return None

            # Reset retry count when task is found
            no_task_retry_count = 0

            status = task.get('status')
            print(f'🦄 Cloud task status: {status}')

            if status == 'succeeded':
                print('🦄 Cloud task completed successfully')
                return task
            elif status == 'failed':
                print('🦄 Cloud task failed')
                return None
            elif status == 'processing':
                # Check if we've exceeded max wait time
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed > max_wait_time:
                    print(
                        f'🦄 Timeout waiting for cloud task completion ({max_wait_time}s)')
                    return None

                print('🦄 Cloud task still processing, waiting 2 seconds...')
                await asyncio.sleep(2)
            else:
                print(f'🦄 Unknown cloud task status: {status}')
                return None

    async def _process_cloud_task_result(self, task: Dict[str, Any], metadata: Optional[Dict[str, Any]] = None) -> tuple[str, int, int, str]:
        """
        Process cloud task result and download image

        Args:
            task: Task data from cloud
            metadata: Optional metadata

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        result_url = task.get('result_url')
        if not result_url:
            raise Exception('No result_url found in cloud task')

        print(f'🦄 Using cloud task result: {result_url}')

        # Download and save the image from cloud result
        image_id = generate_image_id()
        mime_type, width, height, extension = await get_image_info_and_save(
            str(result_url),
            os.path.join(FILES_DIR, f'{image_id}'),
            metadata=metadata
        )

        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename

    async def _make_request(self, url: str, headers: Dict[str, str], data: Dict[str, Any]) -> JaazImagesResponse:
        """
        Send HTTP request and handle response

        Returns:
            JaazImagesResponse: Jaaz compatible image response object
        """
        async with HttpClient.create_aiohttp() as session:
            print(
                f'🦄 Jaaz API request: {url}, model: {data["model"]}, prompt: {data["prompt"]}')

            async with session.post(url, headers=headers, json=data) as response:
                if response.status != 200:
                    error_text = await response.text()
                    error_msg = f"HTTP {response.status}: {error_text}"
                    print(f'🦄 Jaaz API error: {error_msg}')
                    raise Exception(f'Image generation failed: {error_msg}')

                # Parse JSON data
                json_data = await response.json()
                print('🦄 Jaaz API response', json_data)

                return JaazImagesResponse(**json_data)

    async def _process_response(
        self,
        res: JaazImagesResponse,
        error_prefix: str = "Jaaz",
        metadata: Optional[Dict[str, Any]] = None
    ) -> tuple[str, int, int, str]:
        """
        Process ImagesResponse and save image

        Args:
            res: OpenAI ImagesResponse object
            error_prefix: Error message prefix

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        if res.data and len(res.data) > 0:
            image_data = res.data[0]
            if hasattr(image_data, 'url') and image_data.url:
                image_url = image_data.url
                image_id = generate_image_id()
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url,
                    os.path.join(FILES_DIR, f'{image_id}'),
                    metadata=metadata
                )

                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename

        # If no valid image data found
        raise Exception(
            f'{error_prefix} image generation failed: No valid image data in response')

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """
        Generate image using Jaaz API service
        Supports both Replicate format and OpenAI format models

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        # Check if it's an OpenAI model
        if model.startswith('openai/'):
            return await self._generate_openai_image(
                prompt=prompt,
                model=model,
                input_images=input_images,
                aspect_ratio=aspect_ratio,
                metadata=metadata,
                **kwargs
            )

        # Replicate compatible logic
        return await self._generate_replicate_image(
            prompt=prompt,
            model=model,
            aspect_ratio=aspect_ratio,
            input_images=input_images,
            metadata=metadata,
            **kwargs
        )

    async def _generate_replicate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """Generate Replicate format image"""
        try:
            url = self._build_url()
            headers = self._build_headers()

            # Build request data, consistent with Replicate format
            data = {
                "prompt": prompt,
                "model": model,
                "aspect_ratio": aspect_ratio,
            }

            # Add input images if provided
            if input_images:
                # For Replicate format, we take the first image as input_image
                data['input_image'] = input_images[0]
                if len(input_images) > 1:
                    print(
                        "Warning: Replicate format only supports single image input. Using first image.")

            res = await self._make_request(url, headers, data)
            return await self._process_response(res, "Jaaz", metadata)

        except Exception as e:
            print(f'Error generating image with Jaaz: {e}')
            traceback.print_exc()

            # Always attempt cloud task fallback on any error
            print('🦄 Attempting cloud task fallback...')
            try:
                task = await self._wait_for_task_completion(prompt)
                if task:
                    print('🦄 Successfully recovered using cloud task')
                    return await self._process_cloud_task_result(task, metadata)
                else:
                    print('🦄 No cloud task available for recovery')
            except Exception as fallback_error:
                print(f'🦄 Cloud task fallback failed: {fallback_error}')

            # If fallback fails, raise original error
            raise e

    async def _generate_openai_image(
        self,
        prompt: str,
        model: str,
        input_images: Optional[list[str]] = None,
        aspect_ratio: str = "1:1",
        metadata: Optional[Dict[str, Any]] = None,
        **kwargs: Any
    ) -> tuple[str, int, int, str]:
        """
        Generate image using Jaaz API service calling OpenAI model
        Compatible with OpenAI image generation API

        Returns:
            tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        try:
            url = self._build_url()
            headers = self._build_headers()

            # Build request data
            enhanced_prompt = f"{prompt} Aspect ratio: {aspect_ratio}"

            data = {
                "model": model,
                "prompt": enhanced_prompt,
                "n": kwargs.get("num_images", 1),
                "size": 'auto',
                "mask": None,  # Add mask here if needed
            }

            # Add input images if provided
            if input_images:
                data["input_images"] = input_images
                print(f"Using {len(input_images)} input images for generation")

            res = await self._make_request(url, headers, data)
            return await self._process_response(res, "Jaaz OpenAI", metadata)

        except Exception as e:
            print(f'Error generating image with Jaaz OpenAI: {e}')
            traceback.print_exc()

            # Always attempt cloud task fallback on any error
            print('🦄 Attempting cloud task fallback...')
            try:
                # For OpenAI models, use the original prompt
                enhanced_prompt = f"{prompt} Aspect ratio: {aspect_ratio}"
                task = await self._wait_for_task_completion(enhanced_prompt)
                if task:
                    print('🦄 Successfully recovered using cloud task')
                    return await self._process_cloud_task_result(task, metadata)
                else:
                    print('🦄 No cloud task available for recovery')
            except Exception as fallback_error:
                print(f'🦄 Cloud task fallback failed: {fallback_error}')

            # If fallback fails, raise original error
            raise e
