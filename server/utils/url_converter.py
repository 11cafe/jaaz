"""
统一的图片URL转换工具
优先返回腾讯云直链，回退到本地重定向URL
"""

from typing import Optional
from utils.cos_image_service import get_cos_image_service
from common import BASE_URL
from log import get_logger

logger = get_logger(__name__)


class ImageUrlConverter:
    """图片URL转换器 - 统一处理图片地址转换逻辑"""
    
    def __init__(self):
        self.cos_service = get_cos_image_service()
    
    def get_optimal_image_url(self, filename: str, fallback_to_redirect: bool = True, for_canvas: bool = False) -> str:
        """
        获取最优的图片URL - 针对Canvas跨域问题优化
        
        Args:
            filename: 图片文件名 (如 "im_abc123.png")
            fallback_to_redirect: 是否回退到重定向URL，默认True
            for_canvas: 是否用于Canvas，如果是则使用代理URL避免跨域，默认False
            
        Returns:
            最优的图片URL
        """
        if not filename:
            return ""
            
        # 如果已经是完整的URL（腾讯云或其他），直接返回
        if filename.startswith(('http://', 'https://')):
            # 如果是Canvas使用且是跨域URL，转换为代理URL
            if for_canvas and not filename.startswith(BASE_URL):
                # 如果是腾讯云URL，提取文件名并使用代理
                if 'cos.' in filename and 'myqcloud.com' in filename:
                    # 从腾讯云URL中提取文件名
                    if '/' in filename:
                        extracted_filename = filename.split('/')[-1].split('?')[0]
                        proxy_url = f"{BASE_URL}/api/file/{extracted_filename}"
                        logger.debug(f"🖼️ Canvas防跨域: {filename} -> {proxy_url}")
                        return proxy_url
            return filename
            
        # 如果是本地API格式，提取文件名
        if filename.startswith('/api/file/'):
            filename = filename.replace('/api/file/', '')
        
        # 🎯 Canvas特殊处理：避免跨域问题
        if for_canvas:
            # Canvas使用时，始终使用本地代理URL，避免跨域污染
            proxy_url = f"{BASE_URL}/api/file/{filename}"
            logger.debug(f"🖼️ Canvas代理URL: {filename} -> {proxy_url}")
            return proxy_url
            
        try:
            # 🌐 非Canvas使用：优先尝试获取腾讯云直链（性能最佳）
            if self.cos_service.available:
                cos_url = self.cos_service.get_image_url(filename)
                if cos_url:
                    logger.debug(f"✨ 使用腾讯云直链: {filename} -> {cos_url}")
                    return cos_url
                    
        except Exception as e:
            logger.warning(f"⚠️ 获取腾讯云URL失败: {filename}, error: {e}")
        
        # 回退到重定向URL（会自动重定向到腾讯云或本地文件）
        if fallback_to_redirect:
            redirect_url = f"{BASE_URL}/api/file/{filename}?redirect=true"
            logger.debug(f"🔄 使用重定向URL: {filename} -> {redirect_url}")
            return redirect_url
        else:
            # 直接使用本地API URL
            local_url = f"{BASE_URL}/api/file/{filename}"
            logger.debug(f"📁 使用本地URL: {filename} -> {local_url}")
            return local_url
    
    def convert_local_url_to_cos(self, url: str) -> str:
        """
        将本地API URL转换为腾讯云直链URL
        
        Args:
            url: 本地API URL (如 "http://localhost:8000/api/file/im_abc123.png")
            
        Returns:
            腾讯云直链URL，如果转换失败则返回原URL
        """
        if not url or not isinstance(url, str):
            return url
            
        # 检查是否是本地API格式
        if '/api/file/' not in url:
            return url
            
        try:
            # 提取文件名
            if '/api/file/' in url:
                filename = url.split('/api/file/')[-1]
                # 去除查询参数
                if '?' in filename:
                    filename = filename.split('?')[0]
                    
                return self.get_optimal_image_url(filename, fallback_to_redirect=False)
        except Exception as e:
            logger.error(f"❌ 转换URL失败: {url}, error: {e}")
            
        return url
    
    def get_chat_display_url(self, filename: str) -> str:
        """
        获取聊天中显示的图片URL
        优先使用腾讯云直链，确保聊天中图片加载速度最快
        """
        return self.get_optimal_image_url(filename, fallback_to_redirect=True)
    
    def get_canvas_url(self, filename: str) -> str:
        """
        获取Canvas中使用的图片URL
        使用本地代理URL避免跨域污染Canvas
        """
        return self.get_optimal_image_url(filename, fallback_to_redirect=True, for_canvas=True)
    
    def batch_convert_urls(self, urls: list[str]) -> list[str]:
        """
        批量转换URL列表
        """
        return [self.convert_local_url_to_cos(url) for url in urls]


# 全局实例
_url_converter = None

def get_url_converter() -> ImageUrlConverter:
    """获取URL转换器实例"""
    global _url_converter
    if _url_converter is None:
        _url_converter = ImageUrlConverter()
    return _url_converter

# 便捷函数
def get_optimal_image_url(filename: str, fallback_to_redirect: bool = True, for_canvas: bool = False) -> str:
    """便捷函数：获取最优图片URL"""
    return get_url_converter().get_optimal_image_url(filename, fallback_to_redirect, for_canvas)

def convert_to_cos_url(url: str) -> str:
    """便捷函数：转换为腾讯云URL"""
    return get_url_converter().convert_local_url_to_cos(url)

def get_chat_image_url(filename: str) -> str:
    """便捷函数：获取聊天显示URL"""
    return get_url_converter().get_chat_display_url(filename)

def get_canvas_image_url(filename: str) -> str:
    """便捷函数：获取Canvas显示URL"""
    return get_url_converter().get_canvas_url(filename)