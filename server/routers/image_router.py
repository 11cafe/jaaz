from fastapi.responses import FileResponse
from fastapi.concurrency import run_in_threadpool
from common import BASE_URL
from tools.utils.image_canvas_utils import generate_file_id
from services.config_service import FILES_DIR, get_user_files_dir, get_legacy_files_dir
from utils.auth_utils import get_current_user_optional, CurrentUser
from utils.cos_image_service import get_cos_image_service
from typing import Optional, Dict, Any

from PIL import Image
from io import BytesIO
import os
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
import httpx
from mimetypes import guess_type
from utils.http_client import HttpClient
from log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api")
os.makedirs(FILES_DIR, exist_ok=True)

# 上传图片接口，支持表单提交
@router.post("/upload_image")
async def upload_image(
    file: UploadFile = File(...), 
    max_size_mb: float = 50.0,  # 增加默认限制到50MB
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    logger.info(f'🦄upload_image file {file.filename}')
    
    # 正确使用 FastAPI 依赖注入获取用户信息（参考 chat_router.py）
    user_email = current_user.email if current_user else None
    user_id = str(current_user.id) if current_user else None
    logger.info(f'🦄upload_image user_email: {user_email}, user_id: {user_id}')
    
    # 获取用户文件目录（优先使用邮箱）
    user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)  # type: ignore
    
    # 生成文件 ID 和文件名
    file_id = generate_file_id()
    filename = file.filename or ''

    # Read the file content
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {e}")
    original_size_mb = len(content) / (1024 * 1024)  # Convert to MB

    # Open the image from bytes to get its dimensions
    with Image.open(BytesIO(content)) as img:
        width, height = img.size
        
        # Check if compression is needed
        if original_size_mb > max_size_mb:
            logger.info(f'🦄 Image size ({original_size_mb:.2f}MB) exceeds limit ({max_size_mb}MB), compressing...')
            
            # Convert to RGB if necessary (for JPEG compression)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Create a white background for transparent images
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Compress the image
            compressed_content = compress_image(img, max_size_mb)
            
            # Save compressed image using Image.save
            extension = 'jpg'  # Force JPEG for compressed images
            file_path = os.path.join(user_files_dir, f'{file_id}.{extension}')
            
            # Create new image from compressed content and save
            with Image.open(BytesIO(compressed_content)) as compressed_img:
                width, height = compressed_img.size
                await run_in_threadpool(compressed_img.save, file_path, format='JPEG', quality=95, optimize=True)
                # compressed_img.save(file_path, format='JPEG', quality=95, optimize=True)
            
            final_size_mb = len(compressed_content) / (1024 * 1024)
            logger.info(f'🦄 Compressed from {original_size_mb:.2f}MB to {final_size_mb:.2f}MB')
        else:
            # Determine the file extension from original file
            mime_type, _ = guess_type(filename)
            if mime_type and mime_type.startswith('image/'):
                extension = mime_type.split('/')[-1]
                # Handle common image format mappings
                if extension == 'jpeg':
                    extension = 'jpg'
            else:
                extension = 'jpg'  # Default to jpg for unknown types
            
            # Save original image using Image.save
            file_path = os.path.join(user_files_dir, f'{file_id}.{extension}')
            
            # Determine save format based on extension
            save_format = 'JPEG' if extension.lower() in ['jpg', 'jpeg'] else extension.upper()
            if save_format == 'JPEG':
                img = img.convert('RGB')
            
            # img.save(file_path, format=save_format)
            await run_in_threadpool(img.save, file_path, format=save_format)

    # 尝试上传到腾讯云
    cos_service = get_cos_image_service()
    filename_with_ext = f'{file_id}.{extension}'
    content_type = f'image/{extension}' if extension == 'png' else 'image/jpeg'
    
    cos_url = await cos_service.upload_image_from_file(
        local_file_path=file_path,
        image_key=filename_with_ext,
        content_type=content_type,
        delete_local=cos_service.available  # 只有在腾讯云可用时才删除本地文件
    )
    
    if cos_url:
        # 腾讯云上传成功
        logger.info(f'✅ 图片上传到腾讯云成功: {filename_with_ext} -> {cos_url}')
        return {
            'file_id': filename_with_ext,
            'url': cos_url,  # 返回腾讯云URL
            'width': width,
            'height': height,
            'user_email': user_email,
            'user_id': user_id,
            'storage_type': 'tencent_cloud',  # 标记存储类型
        }
    else:
        # 腾讯云不可用，回退到本地存储
        logger.info(f'📁 腾讯云不可用，使用本地存储: {filename_with_ext}')
        local_url = f'{BASE_URL}/api/file/{filename_with_ext}'
        return {
            'file_id': filename_with_ext,
            'url': local_url,  # 返回本地URL
            'width': width,
            'height': height,
            'user_email': user_email,
            'user_id': user_id,
            'storage_type': 'local',  # 标记存储类型
        }


def compress_image(img: Image.Image, max_size_mb: float) -> bytes:
    """
    Compress an image to be under the specified size limit.
    """
    # Start with high quality
    quality = 95
    
    while quality > 10:
        # Save to bytes buffer
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        
        # Check size
        size_mb = len(buffer.getvalue()) / (1024 * 1024)
        
        if size_mb <= max_size_mb:
            return buffer.getvalue()
        
        # Reduce quality for next iteration
        quality -= 10
    
    # If still too large, try reducing dimensions
    original_width, original_height = img.size
    scale_factor = 0.8
    
    while scale_factor > 0.3:
        new_width = int(original_width * scale_factor)
        new_height = int(original_height * scale_factor)
        resized_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # Try with moderate quality
        buffer = BytesIO()
        resized_img.save(buffer, format='JPEG', quality=70, optimize=True)
        
        size_mb = len(buffer.getvalue()) / (1024 * 1024)
        
        if size_mb <= max_size_mb:
            return buffer.getvalue()
        
        scale_factor -= 0.1
    
    # Last resort: very low quality
    buffer = BytesIO()
    resized_img.save(buffer, format='JPEG', quality=30, optimize=True)
    return buffer.getvalue()


# 文件下载接口 - 代理返回腾讯云或本地图片
@router.get("/file/{file_id}")
async def get_file(
    file_id: str,
    current_user: Optional[CurrentUser] = Depends(get_current_user_optional)
):
    # 首先尝试从腾讯云获取图片URL
    cos_service = get_cos_image_service()
    cos_url = cos_service.get_image_url(file_id)
    
    if cos_url:
        logger.info(f'✅ 从腾讯云获取图片: {file_id} -> {cos_url}')
        try:
            # 代理模式：从腾讯云下载图片并返回给前端
            timeout = httpx.Timeout(30.0)
            async with HttpClient.create(timeout=timeout) as client:
                response = await client.get(cos_url)
                if response.status_code == 200:
                    # 设置合适的Content-Type
                    content_type = response.headers.get('content-type', 'image/jpeg')
                    from fastapi.responses import Response
                    return Response(
                        content=response.content,
                        media_type=content_type,
                        headers={
                            "Cache-Control": "public, max-age=3600",  # 缓存1小时
                            "Access-Control-Allow-Origin": "*"  # 允许跨域访问
                        }
                    )
                else:
                    logger.warning(f'⚠️ 腾讯云返回错误状态码 {response.status_code}，回退到本地存储')
        except Exception as e:
            logger.warning(f'⚠️ 从腾讯云获取图片失败: {e}，回退到本地存储')
    
    # 向后兼容：如果腾讯云中没有，尝试从本地文件系统获取
    user_email = current_user.email if current_user else None
    user_id = str(current_user.id) if current_user else None
    logger.info(f"[向后兼容] get_file - user_email: {user_email}, user_id: {user_id}")
    
    # 首先尝试从用户目录查找文件（优先使用邮箱目录）
    if user_email or user_id:
        user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)  # type: ignore
        file_path = os.path.join(user_files_dir, file_id)
        logger.info(f'🦄get_file user file_path: {file_path}')
        
        if os.path.exists(file_path):
            logger.info(f'🦄get_file 成功在用户目录找到文件: {file_path}')
            return FileResponse(file_path)
        
        # 如果邮箱目录中没有，尝试用户ID目录（向后兼容）
        if user_email and user_id:
            legacy_user_dir = get_user_files_dir(user_email=None, user_id=user_id)  # type: ignore
            legacy_file_path = os.path.join(legacy_user_dir, file_id)
            logger.info(f'🦄get_file legacy user file_path: {legacy_file_path}')
            
            if os.path.exists(legacy_file_path):
                logger.info(f'🦄get_file 成功在遗留用户目录找到文件: {legacy_file_path}')
                return FileResponse(legacy_file_path)
    
    # 如果用户目录中没有找到，尝试从匿名用户目录查找
    anonymous_files_dir = get_user_files_dir(user_email=None, user_id=None)  # type: ignore  # 使用匿名用户
    anonymous_file_path = os.path.join(anonymous_files_dir, file_id)
    logger.info(f'🦄get_file anonymous file_path: {anonymous_file_path}')
    
    if os.path.exists(anonymous_file_path):
        return FileResponse(anonymous_file_path)
    
    # 向后兼容：最后尝试从旧的FILES_DIR查找
    legacy_file_path = os.path.join(get_legacy_files_dir(), file_id)
    logger.info(f'🦄get_file legacy file_path: {legacy_file_path}')
    
    if os.path.exists(legacy_file_path):
        return FileResponse(legacy_file_path)
    
    raise HTTPException(status_code=404, detail="File not found")


@router.post("/comfyui/object_info")
async def get_object_info(data: Dict[str, Any]):
    url = data.get('url', '')
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        timeout = httpx.Timeout(10.0)
        async with HttpClient.create(timeout=timeout) as client:
            response = await client.get(f"{url}/api/object_info")
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code, detail=f"ComfyUI server returned status {response.status_code}")
    except Exception as e:
        if "ConnectError" in str(type(e)) or "timeout" in str(e).lower():
            logger.error(f"ComfyUI connection error: {str(e)}")
            raise HTTPException(
                status_code=503, detail="ComfyUI server is not available. Please make sure ComfyUI is running.")
        logger.error(f"Unexpected error connecting to ComfyUI: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to connect to ComfyUI: {str(e)}")
