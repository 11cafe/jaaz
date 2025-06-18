from typing import Dict, Type
from services.config_service import config_service
from .base import ImageProvider
from .providers.replicate import ReplicateProvider
from .providers.jaaz import JaazProvider
from .providers.comfyui import ComfyUIProvider
from .providers.wavespeed import WaveSpeedProvider
from .providers.openai import OpenAIProvider


class ImageProviderFactory:
    """图像生成器工厂类"""

    # Provider映射
    _providers: Dict[str, Type[ImageProvider]] = {
        'replicate': ReplicateProvider,
        'jaaz': JaazProvider,
        'comfyui': ComfyUIProvider,
        'wavespeed': WaveSpeedProvider,
        'openai': OpenAIProvider,
    }

    @classmethod
    def create_provider(cls, provider_name: str) -> ImageProvider:
        """
        根据provider名称创建图像生成器实例

        Args:
            provider_name: Provider名称 (replicate, jaaz, comfyui, 等)

        Returns:
            ImageProvider实例

        Raises:
            ValueError: 当provider不存在或配置无效时
        """
        if provider_name not in cls._providers:
            available_providers = ', '.join(cls._providers.keys())
            raise ValueError(
                f"Unknown provider: {provider_name}. Available providers: {available_providers}")

        # 获取对应provider的配置
        provider_config = config_service.app_config.get(provider_name, {})

        # 创建provider实例
        provider_class = cls._providers[provider_name]
        provider_instance = provider_class(provider_config)

        # 验证配置
        if not provider_instance.validate_config():
            raise ValueError(
                f"Invalid configuration for provider: {provider_name}")

        return provider_instance

    @classmethod
    def get_available_providers(cls) -> list[str]:
        """获取所有可用的provider名称"""
        return list(cls._providers.keys())

    @classmethod
    def register_provider(cls, name: str, provider_class: Type[ImageProvider]):
        """注册新的provider"""
        cls._providers[name] = provider_class
