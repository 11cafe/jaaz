from abc import ABC, abstractmethod
from typing import Optional, Any, Tuple


class ImageProviderBase(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_images: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
        **kwargs: Any
    ) -> Tuple[str, int, int, str]:
        """
        Generate image and return image details

        Args:
            prompt: Image generation prompt
            model: Model name to use for generation
            aspect_ratio: Image aspect ratio (1:1, 16:9, 4:3, 3:4, 9:16)
            input_images: Optional input images for reference or editing
            metadata: Optional metadata to be saved in PNG info
            **kwargs: Additional provider-specific parameters

        Returns:
            Tuple[str, int, int, str]: (mime_type, width, height, filename)
        """
        pass