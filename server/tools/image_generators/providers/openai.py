import os
from typing import Optional, Tuple
from openai import OpenAI
from services.config_service import FILES_DIR
from ..base import ImageProvider, ImageGenerationError, generate_file_id, save_image_from_url


class OpenAIProvider(ImageProvider):
    """OpenAI 图像生成器"""

    def validate_config(self) -> bool:
        """验证OpenAI配置"""
        api_key = self.get_api_key()
        return bool(api_key)

    async def generate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image_b64: Optional[str] = None,
        **kwargs
    ) -> Tuple[str, int, int, str]:
        """生成图像使用OpenAI API"""
        try:
            if not self.validate_config():
                raise ImageGenerationError("OpenAI API key is not configured")

            api_key = self.get_api_key()
            api_url = self.get_api_url()

            # 清理模型名称
            model = model.replace('openai/', '')

            # 创建OpenAI客户端
            client = OpenAI(api_key=api_key,
                            base_url=api_url if api_url else None)

            if input_image_b64:
                # 图像编辑模式
                # 注意：这里需要处理input_image_b64，但OpenAI API需要文件路径
                # 我们需要先将base64保存为临时文件
                temp_image_path = await self._save_temp_image(input_image_b64)

                try:
                    with open(temp_image_path, 'rb') as image_file:
                        result = client.images.edit(
                            model=model,
                            image=image_file,
                            prompt=prompt,
                            n=kwargs.get("num_images", 1)
                        )
                finally:
                    # 清理临时文件
                    if os.path.exists(temp_image_path):
                        os.remove(temp_image_path)
            else:
                # 图像生成模式
                size = self._convert_aspect_ratio_to_size(aspect_ratio)
                result = client.images.generate(
                    model=model,
                    prompt=prompt,
                    n=kwargs.get("num_images", 1),
                    size=size,
                )

            # 获取生成的图像
            image_b64 = result.data[0].b64_json

            if not image_b64:
                raise ImageGenerationError(
                    "OpenAI API did not return image data")

            # 生成文件ID并保存图像
            image_id = generate_file_id()
            mime_type, width, height, extension = await save_image_from_url(
                image_b64,
                os.path.join(FILES_DIR, image_id),
                is_b64=True
            )

            filename = f'{image_id}.{extension}'
            print(f'🦄 OpenAI image generated: {filename}')

            return mime_type, width, height, filename

        except Exception as e:
            print(f'Error generating image with OpenAI: {e}')
            raise ImageGenerationError(f"OpenAI generation failed: {str(e)}")

    async def _save_temp_image(self, image_b64: str) -> str:
        """保存临时图像文件"""
        import base64
        import tempfile
        import aiofiles

        # 解析data URL
        if image_b64.startswith('data:'):
            header, data = image_b64.split(',', 1)
            image_data = base64.b64decode(data)
        else:
            image_data = base64.b64decode(image_b64)

        # 创建临时文件
        temp_fd, temp_path = tempfile.mkstemp(suffix='.png')
        os.close(temp_fd)  # 关闭文件描述符

        # 异步写入文件
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(image_data)

        return temp_path

    def _convert_aspect_ratio_to_size(self, aspect_ratio: str) -> str:
        """将宽高比转换为OpenAI API需要的size格式"""
        aspect_ratio_map = {
            "1:1": "1024x1024",
            "16:9": "1792x1024",  # OpenAI支持的最接近16:9的尺寸
            "4:3": "1024x768",    # 不是标准支持，使用1024x1024作为fallback
            "3:4": "1024x1792",   # OpenAI支持的最接近3:4的尺寸
            "9:16": "1024x1792"   # OpenAI支持的最接近9:16的尺寸
        }
        return aspect_ratio_map.get(aspect_ratio, "1024x1024")
