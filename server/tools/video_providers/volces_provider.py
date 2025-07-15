import json
import traceback
import asyncio
from typing import Optional, Dict, Any, List

from .video_base_provider import VideoProviderBase
from utils.http_client import HttpClient
from services.config_service import config_service


class VolcesVideoProvider(VideoProviderBase, provider_name="volces"):
    """Volces Cloud video generation provider implementation"""

    def __init__(self):
        config = config_service.app_config.get('volces', {})
        self.api_key = config.get("api_key", "")
        self.base_url = config.get("url", "").rstrip("/")
        self.model_name = config.get("model_name", "doubao-seedance-1-0-pro")

        if not self.api_key:
            raise ValueError("Volces API key is not configured")
        if not self.base_url:
            raise ValueError("Volces URL is not configured")

    def _build_api_url(self) -> str:
        """Build API URL for Volces Cloud"""
        return f"{self.base_url}/contents/generations/tasks"

    def _build_headers(self) -> Dict[str, str]:
        """Build request headers"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_request_payload(
        self,
        prompt: str,
        model: str | None = None,
        resolution: str = "480p",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        camera_fixed: bool = True,
        input_image_data: Optional[str] | None = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """Build request payload for Volces API"""
        # Build command string
        command = (
            f"--resolution {resolution} "
            f"--dur {duration} "
            f"--camerafixed {str(camera_fixed).lower()} "
            f"--wm false"
        )

        # Add aspect ratio if no input image
        if not input_image_data:
            command += f" --rt {aspect_ratio}"

        # Build content
        content: List[Dict[str, Any]] = [
            {"type": "text", "text": prompt + " " + command}]

        if isinstance(input_image_data, list) and len(input_image_data) == 1:
            # image-to-video
            content.append({
                "type": "image_url",
                "image_url": {"url": input_image_data[0]}
            })
        elif isinstance(input_image_data, list) and len(input_image_data) == 2:
            # first-last-frame-to-video
            content.append({
                "type": "image_url",
                "image_url": {"url": input_image_data[0]},
                "role": "first_frame"
            })
            content.append({
                "type": "image_url",
                "image_url": {"url": input_image_data[1]},
                "role": "last_frame"
            })

        payload = {
            "model": str(self.model_name.split("by")[0]).rstrip("_") if model is None else model,
            "content": content,
        }

        return payload

    async def _poll_task_status(self, task_id: str, headers: Dict[str, str]) -> str:
        """Poll task status until completion"""
        polling_url = f"{self.base_url}/contents/generations/tasks/{task_id}"
        status = "submitted"

        async with HttpClient.create_aiohttp() as session:
            while status not in ("succeeded", "failed", "cancelled"):
                print(
                    f"🎥 Polling Volces generation {task_id}, current status: {status} ...")
                await asyncio.sleep(3)  # Wait 3 seconds between polls

                async with session.get(polling_url, headers=headers) as poll_response:
                    poll_res = await poll_response.json()
                    status = poll_res.get("status", None)

                    if status == "succeeded":
                        output = poll_res.get(
                            "content", {}).get("video_url", None)
                        if output and isinstance(output, str):
                            return output
                        else:
                            raise Exception(
                                "No video URL found in successful response")
                    elif status in ("failed", "cancelled"):
                        detail_error = poll_res.get(
                            "detail", f"Task failed with status: {status}")
                        raise Exception(
                            f"Volces video generation failed: {detail_error}")

        raise Exception(f"Task polling failed with final status: {status}")

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
        Generate video using Volces API

        Returns:
            str: Video URL for download
        """
        try:
            api_url = self._build_api_url()
            headers = self._build_headers()

            # Use the first input image if provided (already processed as base64)
            input_image_data = input_images if input_images and len(
                input_images) > 0 else None

            # Build request payload
            payload = self._build_request_payload(
                prompt=prompt,
                model=model,
                resolution=resolution,
                duration=duration,
                aspect_ratio=aspect_ratio,
                camera_fixed=camera_fixed,
                input_image_data=input_image_data,
                **kwargs
            )

            print(
                f"🎥 Starting Volces video generation")

            # Make API request to create task
            async with HttpClient.create_aiohttp() as session:
                async with session.post(api_url, headers=headers, json=payload) as response:
                    if response.status != 200:
                        try:
                            error_data = await response.json()
                            error_message = error_data.get(
                                "error", f"HTTP {response.status}")
                        except Exception:
                            error_message = f"HTTP {response.status}"
                        raise Exception(
                            f"Volces task creation failed: {error_message}")

                    result = await response.json()
                    task_id = result.get("id", None)

                if not task_id:
                    print("🎥 Failed to create Volces video generation task:", result)
                    raise Exception(
                        "Volces video generation task creation failed")

                print(
                    f"🎥 Volces video generation task created, task_id: {task_id}")

            # Poll for task completion
            video_url = await self._poll_task_status(task_id, headers)
            print(
                f"🎥 Volces video generation completed, video URL: {video_url}")

            return video_url

        except Exception as e:
            print(f"🎥 Error generating video with Volces: {str(e)}")
            traceback.print_exc()
            raise e
