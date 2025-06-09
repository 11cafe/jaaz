from fastapi import APIRouter, HTTPException, Request
from services.settings_service import settings_service
import aiohttp
from utils.ssl_config import create_aiohttp_session

router = APIRouter(prefix="/api/settings")


@router.get("/exists")
async def settings_exists():
    """Check if settings file exists"""
    return {"exists": await settings_service.exists_settings()}


@router.get("")
async def get_settings():
    """Get all settings (with sensitive data masked)"""
    return settings_service.get_settings()


@router.post("")
async def update_settings(request: Request):
    """Update settings"""
    data = await request.json()
    result = await settings_service.update_settings(data)
    return result


@router.get("/proxy/status")
async def get_proxy_status():
    """Get current proxy configuration status"""
    from utils.ssl_config import get_proxy_config

    proxy_url = get_proxy_config()
    if proxy_url:
        # Don't expose the full proxy URL for security
        return {
            "enable": True,
            "configured": True,
            "message": "Proxy is configured and enabled"
        }
    else:
        settings = settings_service.get_raw_settings()
        proxy_config = settings.get('proxy', {})
        if proxy_config.get('enable', False):
            return {
                "enable": True,
                "configured": False,
                "message": "Proxy is enabled but not properly configured"
            }
        else:
            return {
                "enable": False,
                "configured": False,
                "message": "Proxy is disabled"
            }


@router.get("/proxy/test")
async def test_proxy():
    """Test proxy configuration by making a simple HTTP request"""
    from utils.ssl_config import get_proxy_config

    # Check if proxy is configured
    proxy_url = get_proxy_config()
    if not proxy_url:
        return {"status": "info", "message": "No proxy configured, testing direct connection"}

    # Test multiple URLs for better reliability
    test_urls = [
        "https://httpbin.org/ip",
        "https://api.github.com",
        "https://www.google.com"
    ]

    results = []

    for test_url in test_urls:
        try:
            async with create_aiohttp_session(url=test_url) as session:
                timeout = aiohttp.ClientTimeout(total=10)
                async with session.get(test_url, timeout=timeout) as response:
                    if response.status == 200:
                        if "httpbin.org" in test_url:
                            try:
                                result = await response.json()
                                results.append({
                                    "url": test_url,
                                    "status": "success",
                                    "message": f"Connected successfully via {'proxy' if proxy_url else 'direct connection'}",
                                    "data": result
                                })
                            except:
                                results.append({
                                    "url": test_url,
                                    "status": "success",
                                    "message": f"Connected successfully via {'proxy' if proxy_url else 'direct connection'}"
                                })
                        else:
                            results.append({
                                "url": test_url,
                                "status": "success",
                                "message": f"Connected successfully via {'proxy' if proxy_url else 'direct connection'}"
                            })
                        break  # If one succeeds, we're good
                    else:
                        results.append({
                            "url": test_url,
                            "status": "error",
                            "message": f"HTTP {response.status}"
                        })
        except Exception as e:
            results.append({
                "url": test_url,
                "status": "error",
                "message": f"Connection failed: {str(e)}"
            })

    # Check if any test succeeded
    success_count = sum(1 for r in results if r["status"] == "success")

    if success_count > 0:
        successful_result = next(
            r for r in results if r["status"] == "success")
        return {
            "status": "success",
            "message": successful_result["message"],
            "data": successful_result.get("data"),
            "proxy_configured": proxy_url is not None,
            "proxy_url_masked": "***configured***" if proxy_url else None
        }
    else:
        return {
            "status": "error",
            "message": "All connection tests failed",
            "details": results,
            "proxy_configured": proxy_url is not None,
            "proxy_url_masked": "***configured***" if proxy_url else None
        }


@router.get("/proxy")
async def get_proxy_settings():
    """Get proxy settings only"""
    settings = settings_service.get_settings()
    return settings.get('proxy', {})


@router.post("/proxy")
async def update_proxy_settings(request: Request):
    """Update proxy settings only"""
    proxy_data = await request.json()

    # Validate proxy data structure
    if not isinstance(proxy_data, dict):
        raise HTTPException(
            status_code=400, detail="Invalid proxy configuration")

    # Update only proxy settings
    result = await settings_service.update_settings({"proxy": proxy_data})
    return result
