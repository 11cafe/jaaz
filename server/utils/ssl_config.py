"""
SSL Configuration and Proxy Utilities - SSL配置和代理工具模块

该模块提供 SSL 配置和网络代理相关的工具函数，包括：
- 本地 URL 检测
- 代理配置获取和解析
- SSL 上下文创建
- 带代理支持的 HTTP 客户端创建

主要功能：
1. 自动检测本地 URL，避免对本地服务使用代理
2. 解析和标准化代理配置
3. 创建正确配置的 SSL 上下文
4. 为 aiohttp 和 httpx 创建支持代理的客户端

支持的代理类型：
- HTTP/HTTPS 代理
- SOCKS5 代理
- 带认证的代理（用户名/密码）

依赖模块：
- ssl - Python 标准 SSL 库
- certifi - CA 证书包
- aiohttp - 异步 HTTP 客户端
- httpx - 现代 HTTP 客户端
- urllib.parse - URL 解析工具
"""

import ssl
import certifi
import aiohttp
import httpx
from urllib.parse import urlparse


def is_local_url(url: str) -> bool:
    """
    检查 URL 是否为本地地址

    Args:
        url (str): 要检查的 URL

    Returns:
        bool: 如果是本地地址返回 True，否则返回 False

    Description:
        检测 URL 是否指向本地服务，本地服务通常不需要使用代理。
        支持检测的本地地址模式：
        - localhost 变体：localhost, 127.0.0.1, ::1
        - 私有 IP 范围：192.168.x.x, 10.x.x.x, 172.x.x.x
        - 本地域名：*.local

    Note:
        如果 URL 解析失败，出于安全考虑会假设它是本地地址
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return True

        # 检查 localhost 变体
        if hostname.lower() in ['localhost', '127.0.0.1', '::1']:
            return True

        # 检查私有 IP 地址范围
        if hostname.startswith('192.168.') or hostname.startswith('10.') or hostname.startswith('172.'):
            return True

        # 检查其他本地模式
        if hostname.endswith('.local'):
            return True

        return False
    except Exception:
        return True  # 如果无法解析，为安全起见假设是本地地址


def get_proxy_config():
    """
    获取代理配置

    Returns:
        str | None: 标准化的代理 URL，如果未配置或配置无效则返回 None

    Description:
        从设置服务获取代理配置并将其标准化为可用的代理 URL。
        支持多种输入格式的自动解析和标准化：

        输入格式示例：
        - 完整 URL: http://user:pass@proxy.com:8080
        - 简单格式: proxy.com:8080
        - 仅主机名: proxy.com (会添加默认端口)
        - SOCKS 代理: socks5://proxy.com:1080

        输出格式：
        - HTTP 代理: http://[user:pass@]host:port
        - SOCKS5 代理: socks5://[user:pass@]host:port

    Note:
        使用延迟导入避免循环依赖问题
    """
    try:
        # 延迟导入避免循环依赖
        from services.settings_service import settings_service
        proxy_config = settings_service.get_proxy_config()

        # 检查代理是否启用
        if not proxy_config.get('enable', False):
            return None

        proxy_url = proxy_config.get('url', '').strip()
        if not proxy_url:
            return None

        # 解析代理 URL 以提取组件
        import urllib.parse

        # 处理不同的 URL 格式
        if not proxy_url.startswith(('http://', 'https://', 'socks5://', 'socks://')):
            # 如果没有指定协议，假设为 http
            if ':' in proxy_url:
                # 格式: host:port 或 user:pass@host:port
                proxy_url = f"http://{proxy_url}"
            else:
                # 仅主机名，添加默认端口
                proxy_url = f"http://{proxy_url}:8080"

        try:
            parsed = urllib.parse.urlparse(proxy_url)

            # 确定代理类型
            if parsed.scheme in ['socks5', 'socks']:
                proxy_type = 'socks5'
                default_port = 1080
            else:
                proxy_type = 'http'
                default_port = 8080

            # 提取组件
            host = parsed.hostname
            port = parsed.port or default_port
            username = parsed.username or ''
            password = parsed.password or ''

            if not host:
                return None

            # 构建最终的代理 URL
            if username and password:
                if proxy_type == 'socks5':
                    final_url = f"socks5://{username}:{password}@{host}:{port}"
                else:
                    final_url = f"http://{username}:{password}@{host}:{port}"
            else:
                if proxy_type == 'socks5':
                    final_url = f"socks5://{host}:{port}"
                else:
                    final_url = f"http://{host}:{port}"

            return final_url

        except Exception as parse_error:
            print(
                f"Warning: Failed to parse proxy URL '{proxy_url}': {parse_error}")
            return None

    except Exception as e:
        print(f"Warning: Failed to get proxy config: {e}")
        return None


def create_ssl_context():
    """
    创建 SSL 上下文

    Returns:
        ssl.SSLContext: 配置好的 SSL 上下文对象

    Description:
        创建正确配置的 SSL 上下文，特别适用于 PyInstaller 打包环境。
        使用 certifi 包提供的 CA 证书包，确保 SSL 验证正常工作。

        在打包环境中，系统默认的 CA 证书可能不可用，
        certifi 包提供了一个可靠的 CA 证书集合。

    Fallback:
        如果 certifi 配置失败，会回退到系统默认的 SSL 上下文
    """
    try:
        # 使用 certifi 的 CA 证书包
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        return ssl_context
    except Exception as e:
        print(f"Warning: Failed to create SSL context with certifi: {e}")
        # 回退到默认上下文
        return ssl.create_default_context()


def create_aiohttp_connector(url: str = None):
    """Create aiohttp TCPConnector with proper SSL configuration and proxy support"""
    ssl_context = create_ssl_context()

    # Check if we should use proxy
    if url and is_local_url(url):
        # Local URL, no proxy
        return aiohttp.TCPConnector(ssl=ssl_context)

    # Check for proxy configuration
    proxy_url = get_proxy_config()
    if proxy_url and proxy_url.startswith('socks'):
        # For SOCKS proxy, we need to use a different approach
        # aiohttp doesn't support SOCKS directly, but we can use aiohttp-socks
        try:
            from aiohttp_socks import ProxyConnector
            if proxy_url.startswith('socks5://'):
                return ProxyConnector.from_url(proxy_url, ssl=ssl_context)
        except ImportError:
            print(
                "Warning: aiohttp-socks not installed, falling back to direct connection")
            return aiohttp.TCPConnector(ssl=ssl_context)

    return aiohttp.TCPConnector(ssl=ssl_context)


class ProxyAwareClientSession(aiohttp.ClientSession):
    """Custom ClientSession that automatically handles proxy for non-local URLs"""

    def __init__(self, target_url: str = None, **kwargs):
        self._target_url = target_url
        self._proxy_url = None

        # Get proxy config if not local
        if target_url and not is_local_url(target_url):
            proxy_config = get_proxy_config()
            if proxy_config and not proxy_config.startswith('socks'):
                self._proxy_url = proxy_config

        super().__init__(**kwargs)

    def _request(self, method, url, **kwargs):
        # Add proxy to request if needed and not already specified
        if self._proxy_url and 'proxy' not in kwargs:
            # Only add proxy if the specific URL is not local
            if not is_local_url(str(url)):
                kwargs['proxy'] = self._proxy_url

        return super()._request(method, url, **kwargs)


def create_aiohttp_session(url: str = None, **kwargs):
    """
    创建 aiohttp 客户端会话

    Args:
        url (str, 可选): 目标 URL，用于判断是否需要使用代理
        **kwargs: 传递给 ClientSession 的额外参数

    Returns:
        aiohttp.ClientSession: 配置好的客户端会话对象

    Description:
        创建带有自动代理处理的 aiohttp 客户端会话。

        代理处理逻辑：
        1. 本地 URL 不使用代理
        2. SOCKS 代理使用 aiohttp-socks 连接器
        3. HTTP/HTTPS 代理使用自定义会话类
        4. 无代理配置时使用直连

        SSL 配置：
        所有会话都使用 certifi 提供的 CA 证书包进行 SSL 验证

    Dependencies:
        - aiohttp-socks: 可选，用于 SOCKS 代理支持
    """
    ssl_context = create_ssl_context()

    # 检查是否应该使用代理
    if url and is_local_url(url):
        # 本地 URL，无需代理
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        return aiohttp.ClientSession(connector=connector, **kwargs)

    # 检查代理配置
    proxy_url = get_proxy_config()
    if proxy_url:
        if proxy_url.startswith('socks'):
            # SOCKS 代理，使用特殊连接器
            try:
                from aiohttp_socks import ProxyConnector
                connector = ProxyConnector.from_url(proxy_url, ssl=ssl_context)
                return aiohttp.ClientSession(connector=connector, **kwargs)
            except ImportError:
                print(
                    "Warning: aiohttp-socks not installed, falling back to direct connection")
        else:
            # HTTP/HTTPS 代理，使用自定义会话类
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            return ProxyAwareClientSession(target_url=url, connector=connector, **kwargs)

    # 无需代理
    connector = aiohttp.TCPConnector(ssl=ssl_context)
    return aiohttp.ClientSession(connector=connector, **kwargs)


def create_httpx_client(url: str = None, **kwargs):
    """Create httpx Client with proper SSL configuration and proxy support"""
    try:
        # Use certifi's CA bundle for httpx
        ssl_context = ssl.create_default_context(cafile=certifi.where())

        # Check if we should use proxy
        if url and is_local_url(url):
            # Local URL, no proxy
            return httpx.Client(verify=ssl_context, **kwargs)

        # Check for proxy configuration
        proxy_url = get_proxy_config()
        if proxy_url:
            # httpx uses 'proxy' parameter, not 'proxies'
            kwargs['proxy'] = proxy_url

        return httpx.Client(verify=ssl_context, **kwargs)
    except Exception as e:
        print(f"Warning: Failed to create httpx client with certifi: {e}")
        # Fallback to default verification, remove problematic kwargs
        safe_kwargs = {k: v for k, v in kwargs.items() if k not in [
            'proxy', 'proxies']}
        return httpx.Client(**safe_kwargs)


def create_async_httpx_client(url: str = None, **kwargs):
    """Create httpx AsyncClient with proper SSL configuration and proxy support"""
    try:
        # Use certifi's CA bundle for httpx
        ssl_context = ssl.create_default_context(cafile=certifi.where())

        # Check if we should use proxy
        if url and is_local_url(url):
            # Local URL, no proxy
            return httpx.AsyncClient(verify=ssl_context, **kwargs)

        # Check for proxy configuration
        proxy_url = get_proxy_config()
        if proxy_url:
            # httpx uses 'proxy' parameter, not 'proxies'
            kwargs['proxy'] = proxy_url

        return httpx.AsyncClient(verify=ssl_context, **kwargs)
    except Exception as e:
        print(
            f"Warning: Failed to create async httpx client with certifi: {e}")
        # Fallback to default verification, remove problematic kwargs
        safe_kwargs = {k: v for k, v in kwargs.items() if k not in [
            'proxy', 'proxies']}
        return httpx.AsyncClient(**safe_kwargs)
