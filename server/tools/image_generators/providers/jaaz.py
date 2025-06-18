import os
from typing import Optional, Tuple
from utils.http_client import HttpClient
from services.config_service import FILES_DIR
from ..base import ImageProvider, ImageGenerationError, generate_file_id, save_image_from_url


class JaazProvider(ImageProvider):
    """Jaaz 图像生成器"""

    def validate_config(self) -> bool:
        """验证Jaaz配置"""
        api_key = self.get_api_key()
        api_url = self.get_api_url()
        return bool(api_key and api_url)

    async def generate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image_b64: Optional[str] = None
    ) -> Tuple[str, int, int, str]:
        """生成图像使用Jaaz API"""
        try:
            if not self.validate_config():
                raise ImageGenerationError(
                    "Jaaz API URL or token is not configured")

            api_url = self.get_api_url()
            api_token = self.get_api_key()

            # 构建请求URL
            if api_url.rstrip('/').endswith('/api/v1'):
                url = f"{api_url.rstrip('/')}/image/generations"
            else:
                url = f"{api_url.rstrip('/')}/api/v1/image/generations"

            headers = {
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json"
            }

            # 构建请求数据
            data = {
                "prompt": prompt,
                "model": model,
                "aspect_ratio": aspect_ratio,
            }

            # 如果有输入图像，添加到请求中
            if input_image_b64:
                data['input_image'] = input_image_b64

            print(
                f'🦄 Jaaz image generation request: {prompt[:50]}... with model: {model}')

            async with HttpClient.create() as client:
                response = await client.post(url, headers=headers, json=data)
                res = response.json()

            print('🦄 Jaaz image generation response', res)

            # 从响应中获取图像URL
            output = res.get('output', '')
            if isinstance(output, list) and len(output) > 0:
                output = output[0]  # 取第一张图片

            if not output:
                error_detail = res.get(
                    'detail', res.get('error', 'Unknown error'))
                raise ImageGenerationError(
                    f'Jaaz generation failed: {error_detail}')

            # 生成文件ID并保存图像
            image_id = generate_file_id()
            mime_type, width, height, extension = await save_image_from_url(
                output,
                os.path.join(FILES_DIR, image_id)
            )

            filename = f'{image_id}.{extension}'
            print(f'🦄 Jaaz image generated: {filename}')

            return mime_type, width, height, filename

        except Exception as e:
            print(f'Error generating image with Jaaz: {e}')
            raise ImageGenerationError(f"Jaaz generation failed: {str(e)}")
