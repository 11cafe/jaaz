import os
import traceback
from PIL import Image, PngImagePlugin
from io import BytesIO
import base64
import json
from typing import Any, Optional, Tuple
from nanoid import generate
from utils.http_client import HttpClient
from services.config_service import FILES_DIR, get_user_files_dir, get_legacy_files_dir, USERS_DIR


def generate_image_id() -> str:
    """Generate unique image ID"""
    return generate(size=10)


def _find_image_file(image_filename: str) -> Optional[str]:
    """
    智能查找图片文件，按优先级从多个位置查找
    
    查找顺序：
    1. 如果是绝对路径，直接使用
    2. 从所有用户目录查找（遍历 user_data/users/*/files）
    3. 从旧版本目录查找（向后兼容）
    4. 从匿名用户目录查找
    
    Args:
        image_filename: 图片文件名
        
    Returns:
        找到的文件路径，如果未找到返回None
    """
    if not image_filename:
        return None
    
    # 1. 如果是绝对路径且存在，直接返回
    if os.path.isabs(image_filename) and os.path.exists(image_filename):
        return image_filename
    
    # 2. 从所有用户目录查找
    import glob
    
    # 搜索所有用户目录下的文件
    user_dirs_pattern = os.path.join(USERS_DIR, "*", "files", image_filename)
    matching_files = glob.glob(user_dirs_pattern)
    
    if matching_files:
        # 返回最新修改的文件（如果有多个匹配）
        latest_file = max(matching_files, key=os.path.getmtime)
        print(f"Found image in user directory: {latest_file}")
        return latest_file
    
    # 3. 从旧版本目录查找（向后兼容）
    legacy_path = os.path.join(get_legacy_files_dir(), image_filename)
    if os.path.exists(legacy_path):
        print(f"Found image in legacy directory: {legacy_path}")
        return legacy_path
    
    # 4. 从匿名用户目录查找
    anonymous_path = os.path.join(get_user_files_dir(), image_filename)
    if os.path.exists(anonymous_path):
        print(f"Found image in anonymous directory: {anonymous_path}")
        return anonymous_path
    
    return None


async def get_image_info_and_save(
    url: str,
    file_path_without_extension: str,
    is_b64: bool = False,
    metadata: Optional[dict[str, Any]] = None
) -> Tuple[str, int, int, str]:
    """
    Download image from URL or decode base64, convert to PNG and save with metadata

    Args:
        url: Image URL or base64 string
        file_path_without_extension: File path without extension
        is_b64: Whether the url is a base64 string
        metadata: Optional metadata to be saved in PNG info

    Returns:
        tuple[str, int, int, str]: (mime_type, width, height, extension) - always PNG
    """
    try:
        if is_b64:
            image_data = base64.b64decode(url)
        else:
            # Fetch the image asynchronously
            async with HttpClient.create_aiohttp() as session:
                async with session.get(url) as response:
                    # Read the image content as bytes
                    image_data = await response.read()

        # Open image to get info
        image = Image.open(BytesIO(image_data))
        width, height = image.size
        
        # Store original format for debugging
        original_format = image.format or 'Unknown'
        print(f"Converting {original_format} image to PNG: {width}x{height}")

        # Handle different color modes properly for PNG conversion
        if image.mode == 'P':
            # Palette mode - convert to RGBA to preserve potential transparency
            if 'transparency' in image.info:
                image = image.convert('RGBA')
            else:
                image = image.convert('RGB')
        elif image.mode == 'LA':
            # Grayscale with alpha - convert to RGBA
            image = image.convert('RGBA')
        elif image.mode == 'L':
            # Grayscale - can stay as L or convert to RGB
            # PNG supports grayscale, so we can keep it
            pass
        elif image.mode == 'CMYK':
            # CMYK mode - convert to RGB
            image = image.convert('RGB')
        elif image.mode in ('RGB', 'RGBA'):
            # Already compatible with PNG
            pass
        else:
            # For any other modes, convert to RGB as a safe fallback
            print(f"Warning: Unusual color mode {image.mode}, converting to RGB")
            image = image.convert('RGB')

        # Unified format: always PNG
        extension = 'png'
        mime_type = 'image/png'

        # Prepare PNG info for metadata
        pnginfo = PngImagePlugin.PngInfo()
        
        # Add original format info
        pnginfo.add_text("original_format", original_format)
        
        if metadata:
            for key, value in metadata.items():
                try:
                    # Handle different value types
                    if isinstance(value, (dict, list)):
                        # Serialize complex types as JSON
                        text_value = json.dumps(value, ensure_ascii=False)
                    elif value is None:
                        text_value = "null"
                    else:
                        # Convert to string
                        text_value = str(value)
                    
                    pnginfo.add_text(str(key), text_value)
                except Exception as e:
                    print(f"Warning: Failed to add metadata key '{key}': {e}")
                    traceback.print_stack()

        # Save as PNG with metadata
        file_path = f"{file_path_without_extension}.{extension}"
        
        # Save with optimizations and metadata
        if metadata or original_format != 'PNG':
            image.save(file_path, format='PNG', optimize=True, pnginfo=pnginfo)
        else:
            image.save(file_path, format='PNG', optimize=True)
        
        print(f"Successfully saved as PNG: {file_path}")
        return mime_type, width, height, extension

    except Exception as e:
        print(f"Error processing image: {e}")
        raise e


# Canvas-related utilities have been moved to tools/image_generation/image_canvas_utils.py


# Canvas element generation moved to tools/image_generation/image_canvas_utils.py


# Canvas saving functionality moved to tools/image_generation/image_canvas_utils.py


# Image generation orchestration moved to tools/image_generation/image_generation_core.py
# Notification functions moved to tools/image_generation/image_canvas_utils.py


async def process_input_image(input_image: str | None) -> str | None:
    """
    Process input image and convert to base64 format

    Args:
        input_image: Image file path

    Returns:
        Base64 encoded image with data URL, or None if no image
    """
    if not input_image:
        return None

    try:
        full_path = _find_image_file(input_image)
        if not full_path:
            print(f"Warning: Image file not found in any location: {input_image}")
            return None

        image = Image.open(full_path)
        ext = os.path.splitext(input_image)[1].lower()
        mime_type_map = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webp': 'image/webp'
        }
        mime_type = mime_type_map.get(ext, 'image/jpeg')

        with BytesIO() as output:
            image.save(output, format=str(mime_type.split('/')[1]).upper())
            compressed_data = output.getvalue()
            b64_data = base64.b64encode(compressed_data).decode('utf-8')

        data_url = f"data:{mime_type};base64,{b64_data}"
        return data_url

    except Exception as e:
        print(f"Error processing image {input_image}: {e}")
        return None
