import os
import asyncio
from typing import Optional, Tuple
from utils.http_client import HttpClient
from services.config_service import FILES_DIR
from ..base import ImageProvider, ImageGenerationError, generate_file_id, save_image_from_url


class WaveSpeedProvider(ImageProvider):
    """WaveSpeed 图像生成器"""

    def validate_config(self) -> bool:
        """验证WaveSpeed配置"""
        api_key = self.get_api_key()
        api_url = self.get_api_url()
        return bool(api_key and api_url)

    async def generate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image_b64: Optional[str] = None,
        **kwargs
    ) -> Tuple[str, int, int, str]:
        """生成图像使用WaveSpeed API"""
        try:
            if not self.validate_config():
                raise ImageGenerationError(
                    "WaveSpeed API key or URL is not configured")

            api_key = self.get_api_key()
            url = self.get_api_url()

            async with HttpClient.create() as client:
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'channel': os.environ.get('WAVESPEED_CHANNEL', ''),
                }

                if input_image_b64:
                    # 有输入图像时使用特定模型
                    model = 'wavespeed-ai/flux-kontext-pro/multi'
                    payload = {
                        "prompt": prompt,
                        "images": [input_image_b64],
                        "guidance_scale": kwargs.get("guidance_scale", 3.5),
                        "num_images": kwargs.get("num_images", 1),
                        "safety_tolerance": str(kwargs.get("safety_tolerance", "2"))
                    }
                else:
                    # 转换aspect_ratio为size格式
                    size = self._convert_aspect_ratio_to_size(aspect_ratio)
                    payload = {
                        "enable_base64_output": False,
                        "enable_safety_checker": False,
                        "guidance_scale": kwargs.get("guidance_scale", 3.5),
                        "num_images": kwargs.get("num_images", 1),
                        "num_inference_steps": kwargs.get("num_inference_steps", 28),
                        "prompt": prompt,
                        "seed": -1,
                        "size": size,
                        "strength": kwargs.get("strength", 0.8),
                    }

                endpoint = f"{url.rstrip('/')}/{model}"
                response = await client.post(endpoint, json=payload, headers=headers)
                response_json = response.json()

                if response.status_code != 200 or response_json.get("code") != 200:
                    raise ImageGenerationError(
                        f"WaveSpeed API error: {response_json}")

                result_url = response_json["data"]["urls"]["get"]

                # 轮询获取图片结果
                for _ in range(60):  # 最多等60秒
                    await asyncio.sleep(1)
                    result_resp = await client.get(result_url, headers=headers)
                    result_data = result_resp.json()
                    print("WaveSpeed polling result:", result_data)

                    data = result_data.get("data", {})
                    outputs = data.get("outputs", [])
                    status = data.get("status")

                    if status in ("succeeded", "completed") and outputs:
                        image_url = outputs[0]

                        # 生成文件ID并保存图像
                        image_id = generate_file_id()
                        mime_type, width, height, extension = await save_image_from_url(
                            image_url,
                            os.path.join(FILES_DIR, image_id)
                        )

                        filename = f'{image_id}.{extension}'
                        print(f'🦄 WaveSpeed image generated: {filename}')

                        return mime_type, width, height, filename

                    if status == "failed":
                        raise ImageGenerationError(
                            f"WaveSpeed generation failed: {result_data}")

                raise ImageGenerationError(
                    "WaveSpeed image generation timeout")

        except Exception as e:
            print(f'Error generating image with WaveSpeed: {e}')
            raise ImageGenerationError(
                f"WaveSpeed generation failed: {str(e)}")

    def _convert_aspect_ratio_to_size(self, aspect_ratio: str) -> str:
        """将宽高比转换为WaveSpeed API需要的size格式"""
        aspect_ratio_map = {
            "1:1": "1024*1024",
            "16:9": "1920*1080",
            "4:3": "1024*768",
            "3:4": "768*1024",
            "9:16": "1080*1920"
        }
        return aspect_ratio_map.get(aspect_ratio, "1024*1024")
