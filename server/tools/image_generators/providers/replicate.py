import os
from typing import Optional, Tuple
from utils.http_client import HttpClient
from services.config_service import FILES_DIR
from ..base import ImageProvider, ImageGenerationError, generate_file_id, save_image_from_url


class ReplicateProvider(ImageProvider):
    """Replicate 图像生成器"""

    def validate_config(self) -> bool:
        """验证Replicate配置"""
        api_key = self.get_api_key()
        return bool(api_key)

    async def generate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image_b64: Optional[str] = None
    ) -> Tuple[str, int, int, str]:
        """生成图像使用Replicate API"""
        try:
            if not self.validate_config():
                raise ImageGenerationError("Replicate API key is not set")

            api_key = self.get_api_key()
            url = f"https://api.replicate.com/v1/models/{model}/predictions"

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "Prefer": "wait"
            }

            data = {
                "input": {
                    "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                }
            }

            # 如果有输入图像，使用kontext模型
            if input_image_b64:
                data['input']['input_image'] = input_image_b64
                model = 'black-forest-labs/flux-kontext-pro'

            async with HttpClient.create() as client:
                response = await client.post(url, headers=headers, json=data)
                res = response.json()

            output = res.get('output', '')

            if not output:
                error_detail = res.get('detail', 'Unknown error')
                raise ImageGenerationError(
                    f'Replicate generation failed: {error_detail}')

            # 生成文件ID并保存图像
            image_id = generate_file_id()
            mime_type, width, height, extension = await save_image_from_url(
                output,
                os.path.join(FILES_DIR, image_id)
            )

            filename = f'{image_id}.{extension}'
            print(f'🦄 Replicate image generated: {filename}')

            return mime_type, width, height, filename

        except Exception as e:
            print(f'Error generating image with Replicate: {e}')
            raise ImageGenerationError(
                f"Replicate generation failed: {str(e)}")
