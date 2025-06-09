import ssl
import certifi
import aiohttp
import httpx
from urllib.parse import urlparse


def is_local_url(url: str) -> bool:
    """Check if URL is local (localhost, 127.0.0.1, or local IP ranges)"""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname
        if not hostname:
            return True

        # Check for localhost variants
        if hostname.lower() in ['localhost', '127.0.0.1', '::1']:
            return True

        # Check for local IP ranges
        if hostname.startswith('192.168.') or hostname.startswith('10.') or hostname.startswith('172.'):
            return True

        # Check for other local patterns
        if hostname.endswith('.local'):
            return True

        return False
    except Exception:
        return True  # If we can't parse, assume it's local to be safe


def get_proxy_config():
    """Get proxy configuration from app_settings"""
    try:
        # Lazy import to avoid circular dependency
        from services.settings_service import settings_service
        proxy_config = settings_service.get_proxy_config()
        if not proxy_config.get('enable', False):
            return None

        proxy_url = proxy_config.get('url', '').strip()
        if not proxy_url:
            return None

        # Parse the proxy URL to extract components
        import urllib.parse

        # Handle different URL formats
        if not proxy_url.startswith(('http://', 'https://', 'socks5://', 'socks://')):
            # If no protocol specified, assume http
            if ':' in proxy_url:
                # Format: host:port or user:pass@host:port
                proxy_url = f"http://{proxy_url}"
            else:
                # Just hostname, add default port
                proxy_url = f"http://{proxy_url}:8080"

        try:
            parsed = urllib.parse.urlparse(proxy_url)

            # Determine proxy type
            if parsed.scheme in ['socks5', 'socks']:
                proxy_type = 'socks5'
                default_port = 1080
            else:
                proxy_type = 'http'
                default_port = 8080

            # Extract components
            host = parsed.hostname
            port = parsed.port or default_port
            username = parsed.username or ''
            password = parsed.password or ''

            if not host:
                return None

            # Build final proxy URL
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
    """Create SSL context with proper CA certificates for PyInstaller environments"""
    try:
        # Use certifi's CA bundle
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        return ssl_context
    except Exception as e:
        print(f"Warning: Failed to create SSL context with certifi: {e}")
        # Fallback to default context
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
    """Create aiohttp ClientSession with automatic proxy handling"""
    ssl_context = create_ssl_context()

    # Check if we should use proxy
    if url and is_local_url(url):
        # Local URL, no proxy needed
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        return aiohttp.ClientSession(connector=connector, **kwargs)

    # Check for proxy configuration
    proxy_url = get_proxy_config()
    if proxy_url:
        if proxy_url.startswith('socks'):
            # For SOCKS proxy, use special connector
            try:
                from aiohttp_socks import ProxyConnector
                connector = ProxyConnector.from_url(proxy_url, ssl=ssl_context)
                return aiohttp.ClientSession(connector=connector, **kwargs)
            except ImportError:
                print(
                    "Warning: aiohttp-socks not installed, falling back to direct connection")
        else:
            # For HTTP/HTTPS proxy, use our custom session class
            connector = aiohttp.TCPConnector(ssl=ssl_context)
            return ProxyAwareClientSession(target_url=url, connector=connector, **kwargs)

    # No proxy needed
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
