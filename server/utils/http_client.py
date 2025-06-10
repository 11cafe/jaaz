"""
HTTP 客户端工厂和管理器

本模块提供了统一的 HTTP 客户端创建和管理功能，基于 httpx 库封装，支持：
- 自动 SSL 证书验证
- 智能代理配置（本地地址自动跳过代理）
- 连接池管理和超时控制
- 同步和异步客户端支持

使用指南：
1. 单次/少量请求：使用 HttpClient.create() 自动管理资源
   async with HttpClient.create(url) as client:
       response = await client.get("/api/data")

2. 长期持有客户端：使用 HttpClient.create_async_client() 手动管理
   client = HttpClient.create_async_client(url)
   try:
       response = await client.get("/api/data")
   finally:
       await client.aclose()

3. 同步请求：使用 HttpClient.create_sync()
   with HttpClient.create_sync(url) as client:
       response = client.get("/api/data")
"""
import ssl
import certifi
import httpx
from urllib.parse import urlparse
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager, contextmanager
import logging

logger = logging.getLogger(__name__)


class HttpClient:
    """HTTP 客户端工厂和管理器"""

    @classmethod
    def _create_ssl_context(cls) -> ssl.SSLContext:
        """创建 SSL 上下文"""
        try:
            ssl_context = ssl.create_default_context(cafile=certifi.where())
            return ssl_context
        except Exception as e:
            logger.warning(f"Failed to create SSL context with certifi: {e}")
            return ssl.create_default_context()

    @classmethod
    def _is_local_url(cls, url: str) -> bool:
        """检查 URL 是否为本地地址"""
        try:
            parsed = urlparse(url)
            hostname = parsed.hostname
            if not hostname:
                return True

            # 检查 localhost 变体
            if hostname.lower() in ['localhost', '127.0.0.1', '::1']:
                return True

            # 检查私有 IP 地址范围
            if (hostname.startswith('192.168.') or
                hostname.startswith('10.') or
                    hostname.startswith('172.')):
                return True

            # 检查其他本地模式
            if hostname.endswith('.local'):
                return True

            return False
        except Exception:
            return True

    @classmethod
    def _get_proxy_for_url(cls, url: str) -> Optional[str]:
        """为特定 URL 获取代理配置"""
        # 本地 URL 不使用代理
        if cls._is_local_url(url):
            return None

        try:
            from services.settings_service import settings_service
            proxy_config = settings_service.get_proxy_config()

            if not proxy_config.get('enable', False):
                return None

            proxy_url = proxy_config.get('url', '').strip()
            if not proxy_url:
                return None

            # 标准化代理 URL
            if not proxy_url.startswith(('http://', 'https://', 'socks5://', 'socks://')):
                if ':' in proxy_url:
                    proxy_url = f"http://{proxy_url}"
                else:
                    proxy_url = f"http://{proxy_url}:8080"

            # 修复 socks:// 协议为 socks5://
            if proxy_url.startswith('socks://'):
                proxy_url = proxy_url.replace('socks://', 'socks5://', 1)
                logger.info(
                    f"Converted socks:// to socks5:// for httpx compatibility: {proxy_url}")

            return proxy_url

        except Exception as e:
            logger.warning(f"Failed to get proxy config: {e}")
            return None

    @classmethod
    def _get_client_config(cls, url: Optional[str] = None, **kwargs) -> Dict[str, Any]:
        """获取客户端配置"""
        config = {
            'verify': cls._create_ssl_context(),
            'timeout': httpx.Timeout(30.0),
            'follow_redirects': True,
            'limits': httpx.Limits(
                max_keepalive_connections=20,
                max_connections=100,
                keepalive_expiry=30.0
            ),
            **kwargs
        }

        # 为特定 URL 配置代理
        if url:
            proxy = cls._get_proxy_for_url(url)
            if proxy:
                config['proxy'] = proxy
                logger.debug(f"Using proxy for {url}: {proxy}")

        return config

    # ========== 工厂方法 ==========

    @classmethod
    @asynccontextmanager
    async def create(cls, url: Optional[str] = None, **kwargs):
        """创建异步客户端"""
        config = cls._get_client_config(url, **kwargs)
        client = httpx.AsyncClient(**config)
        try:
            yield client
        finally:
            await client.aclose()

    @classmethod
    @contextmanager
    def create_sync(cls, url: Optional[str] = None, **kwargs):
        """创建同步客户端"""
        config = cls._get_client_config(url, **kwargs)
        client = httpx.Client(**config)
        try:
            yield client
        finally:
            client.close()

    @classmethod
    def create_async_client(cls, url: Optional[str] = None, **kwargs) -> httpx.AsyncClient:
        """直接创建异步客户端（需要手动关闭）"""
        config = cls._get_client_config(url, **kwargs)
        return httpx.AsyncClient(**config)

    @classmethod
    def create_sync_client(cls, url: Optional[str] = None, **kwargs) -> httpx.Client:
        """直接创建同步客户端（需要手动关闭）"""
        config = cls._get_client_config(url, **kwargs)
        return httpx.Client(**config)


# 便捷的全局函数
create_async_client = HttpClient.create_async_client
create_sync_client = HttpClient.create_sync_client
async_client = HttpClient.create
sync_client = HttpClient.create_sync
