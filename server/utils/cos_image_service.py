"""
腾讯云图片上传服务
统一处理图片上传到腾讯云COS的逻辑
"""

import os
import aiofiles
from typing import Optional, Tuple
from utils.cos import CosUtils
from log import get_logger

logger = get_logger(__name__)


class CosImageService:
    """腾讯云图片上传服务"""
    
    def __init__(self):
        """初始化腾讯云服务"""
        self.cos_utils = None
        self.available = False
        
        try:
            # 检查环境变量是否配置
            import os
            if not all([os.getenv('COS_SECRET_ID'), os.getenv('COS_SECRET_KEY'), os.getenv('COS_REGION')]):
                logger.warning("⚠️ 腾讯云COS环境变量未配置，将使用本地存储")
                return
                
            self.cos_utils = CosUtils()
            self.available = True
            logger.info("✅ 腾讯云COS服务初始化成功")
        except Exception as e:
            logger.warning(f"⚠️ 腾讯云COS服务初始化失败，将使用本地存储: {e}")
            self.available = False
    
    async def upload_image_from_file(self, local_file_path: str, image_key: str, content_type: str = 'image/png', delete_local: bool = True) -> Optional[str]:
        """
        从本地文件上传图片到腾讯云
        
        Args:
            local_file_path: 本地文件路径
            image_key: 腾讯云存储的key（文件名）
            content_type: 文件类型，默认image/png
            delete_local: 是否删除本地文件，默认True
        
        Returns:
            成功返回腾讯云URL，失败返回None
        """
        if not self.available:
            logger.debug("腾讯云服务不可用，跳过上传")
            return None
            
        try:
            # 检查本地文件是否存在
            if not os.path.exists(local_file_path):
                logger.error(f"❌ 本地文件不存在: {local_file_path}")
                return None
            
            # 读取文件内容
            async with aiofiles.open(local_file_path, 'rb') as file:
                image_bytes = await file.read()
            
            # 上传到腾讯云
            cos_url = self.cos_utils.upload_image_from_bytes(
                image_bytes=image_bytes,
                cos_file_path=image_key,
                content_type=content_type
            )
            
            if cos_url:
                logger.info(f"✅ 图片上传成功: {image_key} -> {cos_url}")
                
                # 删除本地临时文件
                if delete_local:
                    try:
                        os.remove(local_file_path)
                        logger.info(f"🗑️ 本地临时文件已删除: {local_file_path}")
                    except Exception as e:
                        logger.warning(f"⚠️ 删除本地文件失败: {local_file_path}, 错误: {e}")
                
                return cos_url
            else:
                logger.error(f"❌ 图片上传失败: {image_key}")
                return None
                
        except Exception as e:
            logger.error(f"❌ 上传图片到腾讯云失败: {e}")
            return None
    
    async def upload_image_from_bytes(self, image_bytes: bytes, image_key: str, content_type: str = 'image/png') -> Optional[str]:
        """
        从字节数据上传图片到腾讯云
        
        Args:
            image_bytes: 图片字节数据
            image_key: 腾讯云存储的key（文件名）
            content_type: 文件类型，默认image/png
        
        Returns:
            成功返回腾讯云URL，失败返回None
        """
        if not self.available:
            logger.debug("腾讯云服务不可用，跳过上传")
            return None
            
        try:
            cos_url = self.cos_utils.upload_image_from_bytes(
                image_bytes=image_bytes,
                cos_file_path=image_key,
                content_type=content_type
            )
            
            if cos_url:
                logger.info(f"✅ 图片字节数据上传成功: {image_key} -> {cos_url}")
                return cos_url
            else:
                logger.error(f"❌ 图片字节数据上传失败: {image_key}")
                return None
                
        except Exception as e:
            logger.error(f"❌ 上传图片字节数据到腾讯云失败: {e}")
            return None
    
    def get_image_url(self, image_key: str) -> Optional[str]:
        """
        获取图片的腾讯云访问URL
        
        Args:
            image_key: 图片在腾讯云的key（文件名）
        
        Returns:
            图片访问URL
        """
        if not self.available:
            logger.debug("腾讯云服务不可用，返回None")
            return None
            
        try:
            url = self.cos_utils.get_file_url(image_key)
            logger.debug(f"📸 获取图片URL: {image_key} -> {url}")
            return url
        except Exception as e:
            logger.error(f"❌ 获取图片URL失败: {image_key}, 错误: {e}")
            return None
    
    def extract_key_from_filename(self, filename: str) -> str:
        """
        从文件名中提取腾讯云存储的key
        根据用户需求，key就是文件名本身
        
        Args:
            filename: 文件名，如 "im_9bUhMvsX.png"
        
        Returns:
            腾讯云存储的key，如 "im_9bUhMvsX.png"
        """
        return filename


# 全局实例
cos_image_service = None

def get_cos_image_service() -> CosImageService:
    """获取腾讯云图片服务实例"""
    global cos_image_service
    if cos_image_service is None:
        cos_image_service = CosImageService()
    return cos_image_service