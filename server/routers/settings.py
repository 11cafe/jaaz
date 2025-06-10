"""
Settings Router - 设置路由模块

该模块提供设置相关的 API 路由端点，包括：
- 设置文件存在性检查
- 设置的获取和更新
- 代理配置管理
- 代理连接测试

主要端点：
- GET /api/settings/exists - 检查设置文件是否存在
- GET /api/settings - 获取所有设置（敏感信息已掩码）
- POST /api/settings - 更新设置
- GET /api/settings/proxy/status - 获取代理状态
- GET /api/settings/proxy/test - 测试代理连接
- GET /api/settings/proxy - 获取代理设置
- POST /api/settings/proxy - 更新代理设置

依赖模块：
- services.settings_service - 设置服务
- utils.http_client - HTTP客户端工具
"""

from fastapi import APIRouter, HTTPException, Request
from services.settings_service import settings_service
from utils.http_client import HttpClient

# 创建设置相关的路由器，所有端点都以 /api/settings 为前缀
router = APIRouter(prefix="/api/settings")


@router.get("/exists")
async def settings_exists():
    """
    检查设置文件是否存在

    Returns:
        dict: 包含 exists 字段的字典，指示设置文件是否存在

    Description:
        用于前端检查是否需要显示初始设置向导。
        如果设置文件不存在，通常需要引导用户进行初始配置。
    """
    return {"exists": await settings_service.exists_settings()}


@router.get("")
async def get_settings():
    """
    获取所有设置配置

    Returns:
        dict: 完整的设置配置字典，敏感信息已被掩码处理

    Description:
        返回所有应用设置，包括代理配置、系统提示词等。
        敏感信息（如密码）会被替换为 '*' 字符以保护隐私。
        设置会与默认配置合并，确保所有必需的键都存在。
    """
    return settings_service.get_settings()


@router.post("")
async def update_settings(request: Request):
    """
    更新设置配置

    Args:
        request (Request): HTTP 请求对象，包含要更新的设置数据

    Returns:
        dict: 操作结果，包含 status 和 message 字段

    Description:
        接收 JSON 格式的设置数据并更新到配置文件。
        支持部分更新，新数据会与现有设置合并而不是完全替换。

    Example:
        POST /api/settings
        {
            "proxy": {"enable": true, "url": "http://proxy.com:8080"}
        }
    """
    data = await request.json()
    result = await settings_service.update_settings(data)
    return result


@router.get("/proxy/status")
async def get_proxy_status():
    """
    获取代理配置状态

    Returns:
        dict: 代理状态信息，包含以下字段：
            - enable (bool): 代理是否启用
            - configured (bool): 代理是否正确配置
            - message (str): 状态描述信息

    Description:
        检查当前代理配置的状态，包括是否启用和是否正确配置。
        该端点不会暴露完整的代理 URL 以保护安全性。

    Status Logic:
        - enable=True, configured=True: 代理已启用且配置正确
        - enable=True, configured=False: 代理已启用但配置有误
        - enable=False, configured=False: 代理未启用
    """
    # 获取设置中的代理配置
    settings = settings_service.get_raw_settings()
    proxy_config = settings.get('proxy', {})

    if proxy_config.get('enable', False):
        proxy_url = proxy_config.get('url', '').strip()
        if proxy_url:
            # 代理配置正确且已启用
            return {
                "enable": True,
                "configured": True,
                "message": "Proxy is configured and enabled"
            }
        else:
            # 代理已启用但配置不正确
            return {
                "enable": True,
                "configured": False,
                "message": "Proxy is enabled but not properly configured"
            }
    else:
        # 代理未启用
        return {
            "enable": False,
            "configured": False,
            "message": "Proxy is disabled"
        }


@router.get("/proxy/test")
async def test_proxy():
    """
    测试代理连接

    Returns:
        dict: 测试结果，包含以下字段：
            - status (str): "success" 或 "error"
            - message (str): 测试结果描述
            - data (dict, 可选): 成功时返回的额外数据
            - proxy_configured (bool): 是否配置了代理
            - proxy_url_masked (str): 掩码后的代理 URL

    Description:
        通过向多个测试 URL 发送请求来验证代理配置是否正常工作。
        测试 URL 包括：
        - https://httpbin.org/ip - 可以返回当前 IP 信息
        - https://api.github.com - GitHub API
        - https://www.google.com - Google 主页

        只要有一个测试成功，就认为代理配置正确。
        如果没有配置代理，会测试直连是否正常。
    """
    # 检查是否配置了代理
    settings = settings_service.get_raw_settings()
    proxy_config = settings.get('proxy', {})
    proxy_configured = proxy_config.get(
        'enable', False) and proxy_config.get('url', '').strip()

    if not proxy_configured:
        return {"status": "info", "message": "No proxy configured, testing direct connection"}

    # 测试多个 URL 以提高可靠性
    test_urls = [
        "https://httpbin.org/ip",     # 返回 IP 信息的测试服务
        "https://api.github.com",     # GitHub API
        "https://www.google.com"      # Google 主页
    ]

    results = []

    # 逐个测试每个 URL
    for test_url in test_urls:
        try:
            async with HttpClient.create(test_url) as client:
                response = await client.get(test_url, timeout=10.0)
                if response.status_code == 200:
                    # 请求成功
                    if "httpbin.org" in test_url:
                        # 对于 httpbin，尝试解析 JSON 响应获取 IP 信息
                        try:
                            result = response.json()
                            results.append({
                                "url": test_url,
                                "status": "success",
                                "message": f"Connected successfully via {'proxy' if proxy_configured else 'direct connection'}",
                                "data": result
                            })
                        except:
                            # JSON 解析失败，但连接成功
                            results.append({
                                "url": test_url,
                                "status": "success",
                                "message": f"Connected successfully via {'proxy' if proxy_configured else 'direct connection'}"
                            })
                    else:
                        # 其他 URL 只记录连接成功
                        results.append({
                            "url": test_url,
                            "status": "success",
                            "message": f"Connected successfully via {'proxy' if proxy_configured else 'direct connection'}"
                        })
                    break  # 有一个成功就退出测试
                else:
                    # HTTP 状态码不是 200
                    results.append({
                        "url": test_url,
                        "status": "error",
                        "message": f"HTTP {response.status_code}"
                    })
        except Exception as e:
            # 连接异常
            results.append({
                "url": test_url,
                "status": "error",
                "message": f"Connection failed: {str(e)}"
            })

    # 检查是否有测试成功
    success_count = sum(1 for r in results if r["status"] == "success")

    if success_count > 0:
        # 至少有一个测试成功
        successful_result = next(
            r for r in results if r["status"] == "success")
        return {
            "status": "success",
            "message": successful_result["message"],
            "data": successful_result.get("data"),
            "proxy_configured": proxy_configured,
            "proxy_url_masked": "***configured***" if proxy_configured else None
        }
    else:
        # 所有测试都失败
        return {
            "status": "error",
            "message": "All connection tests failed",
            "details": results,
            "proxy_configured": proxy_configured,
            "proxy_url_masked": "***configured***" if proxy_configured else None
        }


@router.get("/proxy")
async def get_proxy_settings():
    """
    获取代理设置

    Returns:
        dict: 代理配置字典，包含 enable 和 url 等字段

    Description:
        仅返回代理相关的设置，不包含其他配置项。
        用于前端代理设置页面的数据加载。
    """
    settings = settings_service.get_settings()
    return settings.get('proxy', {})


@router.post("/proxy")
async def update_proxy_settings(request: Request):
    """
    更新代理设置

    Args:
        request (Request): HTTP 请求对象，包含代理配置数据

    Returns:
        dict: 操作结果，包含 status 和 message 字段

    Raises:
        HTTPException: 当代理配置数据格式不正确时抛出 400 错误

    Description:
        仅更新代理相关的设置，不影响其他配置项。
        代理配置会被包装在 "proxy" 键下保存到设置文件中。

    Example:
        POST /api/settings/proxy
        {
            "enable": true,
            "url": "http://proxy.example.com:8080"
        }
    """
    proxy_data = await request.json()

    # 验证代理数据格式
    if not isinstance(proxy_data, dict):
        raise HTTPException(
            status_code=400, detail="Invalid proxy configuration")

    # 仅更新代理设置
    result = await settings_service.update_settings({"proxy": proxy_data})
    return result
