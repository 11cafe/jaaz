import traceback
import asyncio
from typing import Optional, Dict, Any, List
from .video_base_provider import VideoProviderBase
from utils.http_client import HttpClient
from services.config_service import config_service


class JaazVideoProvider(VideoProviderBase, provider_name="jaaz"):
    """Jaaz Cloud video generation provider implementation"""

    def __init__(self):
        config = config_service.app_config.get('jaaz', {})
        self.api_url = str(config.get("url", "")).rstrip("/")
        self.api_token = str(config.get("api_key", ""))

        if not self.api_url:
            raise ValueError("Jaaz API URL is not configured")
        if not self.api_token:
            raise ValueError("Jaaz API token is not configured")

    def _build_headers(self) -> dict[str, str]:
        """Build request headers"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    async def _submit_generation_task(
        self,
        prompt: str,
        model: str,
        resolution: str = "480p",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        camera_fixed: bool = True,
        input_images: Optional[List[str]] = None,
        **kwargs: Any
    ) -> str:
        """Submit video generation task and return task_id"""
        try:
            # Build generation URL
            if self.api_url.rstrip('/').endswith('/api/v1'):
                url = f"{self.api_url.rstrip('/')}/video/seedance/generation"
            else:
                url = f"{self.api_url.rstrip('/')}/api/v1/video/seedance/generation"

            headers = self._build_headers()

            # Build request payload
            payloadData = {
                "prompt": prompt,
                "model": model,
                "resolution": resolution,
                "duration": duration,
                "aspect_ratio": aspect_ratio,
                "camera_fixed": camera_fixed,
                "input_images": input_images,
                **kwargs
            }

            print(
                f'🎥 Jaaz API generation request: {url}, model: {payloadData["model"]}, prompt: {payloadData["prompt"]}')

            # Make API request to submit generation task
            async with HttpClient.create_aiohttp() as session:
                async with session.post(url, headers=headers, json=payloadData) as response:
                    response_content = await response.read()

                    if response.status != 200:
                        try:
                            error_data: Dict[str, Any] = await response.json() if response_content else {}
                            error_message = error_data.get(
                                "error", f"HTTP {response.status}")
                        except Exception:
                            error_text = await response.text() if response_content else ''
                            error_message = f"HTTP {response.status} {error_text}"
                        raise Exception(
                            f'Video generation submission failed: {error_message}')

                    if not response_content:
                        raise Exception(
                            'Video generation submission failed: Empty response from server')

                    # Parse JSON data
                    result = await response.json()
                    print('🎥 Jaaz API generation response:', result)

                    # Extract task_id
                    task_id = result.get("task_id")
                    if not task_id:
                        raise Exception(
                            "No task_id returned from generation API")

                    return task_id

        except Exception as e:
            print('Error submitting video generation task:', e)
            traceback.print_exc()
            raise e

    async def _poll_task_status(self, task_id: str) -> str:
        """Poll task status and return video URL when completed"""
        try:
            headers = self._build_headers()

            # Build poll URL
            if self.api_url.rstrip('/').endswith('/api/v1'):
                poll_url = f"{self.api_url.rstrip('/')}/video/seedance/poll?task_id={task_id}"
            else:
                poll_url = f"{self.api_url.rstrip('/')}/api/v1/video/seedance/poll?task_id={task_id}"

            print(f'🎥 Polling task status for task_id: {task_id}')

            status = "processing"

            async with HttpClient.create_aiohttp() as session:
                while status not in ("succeeded", "failed", "cancelled"):
                    print(
                        f'🎥 Polling Jaaz generation {task_id}, current status: {status}...')
                    await asyncio.sleep(2)  # Wait 2 seconds between polls

                    async with session.get(poll_url, headers=headers) as response:
                        response_content = await response.read()

                        if response.status != 200:
                            try:
                                error_data: Dict[str, Any] = await response.json() if response_content else {}
                                error_message = error_data.get(
                                    "error", f"HTTP {response.status}")
                            except Exception:
                                error_text = await response.text() if response_content else ''
                                error_message = f"HTTP {response.status} {error_text}"
                            raise Exception(f'Polling failed: {error_message}')

                        if not response_content:
                            raise Exception(
                                'Polling failed: Empty response from server')

                        result = await response.json()
                        status = result.get("status")

                        if status == "succeeded":
                            # Extract video URL from successful response
                            content = result.get("content", {})
                            video_url = content.get("video_url")
                            if not video_url:
                                raise Exception(
                                    "No video_url in successful response")

                            print(
                                f"🎥 Video generation completed successfully: {video_url}")
                            return video_url

                        elif status == "failed" or status == "cancelled":
                            error_details = result.get("error", result)
                            raise Exception(
                                f"Video generation failed with status: {status}, details: {error_details}")

            raise Exception(f"Task polling failed with final status: {status}")

        except Exception as e:
            print(f'Error polling task status for task_id {task_id}:', e)
            traceback.print_exc()
            raise e

    async def generate(
        self,
        prompt: str,
        model: str,
        resolution: str = "480p",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        input_images: Optional[List[str]] = None,
        camera_fixed: bool = True,
        **kwargs: Any
    ) -> str:
        """
        Generate video using Jaaz Cloud API with async task submission and polling

        Returns:
            str: Video URL for download
        """
        try:
            # Step 1: Submit generation task
            task_id = await self._submit_generation_task(
                prompt=prompt,
                model=model,
                resolution=resolution,
                duration=duration,
                aspect_ratio=aspect_ratio,
                camera_fixed=camera_fixed,
                input_images=input_images,
                **kwargs
            )

            print(f'🎥 Task submitted successfully, task_id: {task_id}')

            # Step 2: Poll for completion
            video_url = await self._poll_task_status(task_id)

            return video_url

        except Exception as e:
            print('Error generating video with Jaaz:', e)
            traceback.print_exc()
            raise e
