from abc import ABC, abstractmethod
from typing import Optional, Tuple
import base64
from PIL import Image
from io import BytesIO
import aiofiles
from nanoid import generate
from utils.http_client import HttpClient
from mimetypes import guess_type


class ImageProvider(ABC):
    """图像生成器抽象基类"""

    def __init__(self, config: dict):
        self.config = config

    @abstractmethod
    async def generate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image_b64: Optional[str] = None
    ) -> Tuple[str, int, int, str]:
        """
        生成图像

        Args:
            prompt: 生成提示词
            model: 模型名称
            aspect_ratio: 宽高比
            input_image_b64: 可选的输入图像base64数据

        Returns:
            Tuple[mime_type, width, height, filename]
        """
        pass

    @abstractmethod
    def validate_config(self) -> bool:
        """验证配置是否正确"""
        pass

    def get_api_key(self) -> str:
        """获取API密钥"""
        return self.config.get('api_key', '')

    def get_api_url(self) -> str:
        """获取API URL"""
        return self.config.get('url', '')


class ImageGenerationError(Exception):
    """图像生成异常"""
    pass


# 公共工具函数
def generate_file_id() -> str:
    """生成唯一文件ID"""
    return 'im_' + generate(size=8)


async def save_image_from_url(url: str, file_path_without_extension: str, is_b64: bool = False) -> Tuple[str, int, int, str]:
    """
    从URL或base64保存图像并返回信息

    Args:
        url: 图像URL或base64数据
        file_path_without_extension: 不包含扩展名的文件路径
        is_b64: 是否为base64数据

    Returns:
        Tuple[mime_type, width, height, extension]
    """
    if is_b64:
        image_content = base64.b64decode(url)
    else:
        # 异步获取图像
        async with HttpClient.create() as client:
            response = await client.get(url)
            image_content = response.content

    # 打开图像
    image = Image.open(BytesIO(image_content))

    # 获取MIME类型
    mime_type = Image.MIME.get(image.format if image.format else 'PNG')

    # 获取尺寸
    width, height = image.size

    # 确定文件扩展名
    extension = image.format.lower() if image.format else 'png'
    file_path = f"{file_path_without_extension}.{extension}"

    # 异步保存图像
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(image_content)

    print(f'🦄 Image saved to: {file_path}')

    return mime_type, width, height, extension


def prepare_input_image(input_image_path: str) -> str:
    """准备输入图像为base64格式"""
    with open(input_image_path, 'rb') as f:
        image_data = f.read()
    b64 = base64.b64encode(image_data).decode('utf-8')

    mime_type, _ = guess_type(input_image_path)
    if not mime_type:
        mime_type = "image/png"

    return f"data:{mime_type};base64,{b64}"
