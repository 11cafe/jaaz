import traceback
import asyncio
from utils.http_client import HttpClient
from services.config_service import config_service


class JaazHailuoProvider:
    """Jaaz Cloud Hailuo video generation provider"""

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

    async def generate(
        self,
        prompt: str,
        model: str = "hailuo-02",
        prompt_enhancer: bool = False,
        resolution: str = "1080p",
        duration: int = 6,
    ) -> str:
        """
        Generate video using Jaaz Cloud Hailuo API

        Returns:
            str: Video URL for download
        """
        try:
            # Build URLs
            if self.api_url.rstrip('/').endswith('/api/v1'):
                generation_url = f"{self.api_url.rstrip('/')}/video/hailuo/generation"
            else:
                generation_url = f"{self.api_url.rstrip('/')}/api/v1/video/hailuo/generation"

            headers = self._build_headers()

            # Build request payload
            payload = {
                "prompt": prompt,
                "model": model,
                "prompt_enhancer": prompt_enhancer,
                "resolution": resolution,
                "duration": duration,
            }

            print(
                f'🎥 Jaaz Hailuo generation request: {generation_url}, model: {model}, prompt: {prompt}')

            # Step 1: Submit generation task
            async with HttpClient.create_aiohttp() as session:
                async with session.post(generation_url, headers=headers, json=payload) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        raise Exception(
                            f'Hailuo generation submission failed: HTTP {response.status} {error_text}')

                    result = await response.json()
                    print('🎥 Jaaz Hailuo generation response:', result)

                    task_id = result.get("task_id")
                    if not task_id:
                        raise Exception(
                            "No task_id returned from Hailuo generation API")

                print(
                    f'🎥 Hailuo task submitted successfully, task_id: {task_id}')

                # Step 2: Poll for completion
                if self.api_url.rstrip('/').endswith('/api/v1'):
                    poll_url = f"{self.api_url.rstrip('/')}/video/hailuo/poll?task_id={task_id}"
                else:
                    poll_url = f"{self.api_url.rstrip('/')}/api/v1/video/hailuo/poll?task_id={task_id}"

                print(f'🎥 Polling Hailuo task status for task_id: {task_id}')

                status = "PROCESSING"
                while status not in ("COMPLETED", "FAILED"):
                    print(
                        f'🎥 Polling Jaaz Hailuo generation {task_id}, current status: {status}...')
                    await asyncio.sleep(3)  # Wait 3 seconds between polls

                    async with session.get(poll_url, headers=headers) as poll_response:
                        if poll_response.status != 200:
                            error_text = await poll_response.text()
                            raise Exception(
                                f'Hailuo polling failed: HTTP {poll_response.status} {error_text}')

                        result = await poll_response.json()
                        status = result.get("status")

                        if status == "COMPLETED":
                            # Extract video URL from successful response
                            data = result.get("data", {})
                            video_data = data.get("video", {})
                            video_url = video_data.get("url")
                            if not video_url:
                                raise Exception(
                                    "No video URL in successful Hailuo response")

                            print(
                                f"🎥 Hailuo video generation completed successfully: {video_url}")
                            return video_url

                        elif status == "FAILED":
                            error_details = result.get("error", result)
                            raise Exception(
                                f"Hailuo video generation failed: {error_details}")

                raise Exception(
                    f"Hailuo task polling failed with final status: {status}")

        except Exception as e:
            print('Error generating video with Jaaz Hailuo:', e)
            traceback.print_exc()
            raise e
