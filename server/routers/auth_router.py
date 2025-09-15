import os
import secrets
import urllib.parse as urlparse
from typing import Dict, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import RedirectResponse
from fastapi import Response
import httpx
import jwt
import asyncio
from log import get_logger
from services.db_service import db_service
from services.invite_service import invite_service

logger = get_logger(__name__)

# HTTP 客户端超时配置（针对国内网络环境优化）
HTTP_TIMEOUT = httpx.Timeout(
    connect=30.0,  # 连接超时 30秒（针对国内访问Google API网络延迟）
    read=60.0,     # 读取超时 60秒
    write=20.0,    # 写入超时 20秒
    pool=120.0     # 连接池超时 120秒
)

# HTTP 客户端连接限制配置
HTTP_LIMITS = httpx.Limits(
    max_keepalive_connections=10,
    max_connections=20,
    keepalive_expiry=30.0
)

async def test_google_connectivity() -> bool:
    """测试Google API连通性"""
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0)) as client:
            response = await client.get("https://www.googleapis.com/oauth2/v2/userinfo", 
                                      headers={"Authorization": "Bearer invalid_token"})
            # 只要能连接到并获得响应（即使是401错误）都说明网络可达
            return True
    except Exception as e:
        logger.warning(f"Google API connectivity test failed: {e}")
        return False


from dotenv import load_dotenv

# 确保加载环境变量
load_dotenv()


router = APIRouter()

@router.get("/api/pricing")
async def get_pricing_info(request: Request):
    """获取用户定价信息，包括用户等级和可用套餐"""
    try:
        logger.info("🎯 PRICING: 收到前端/pricing页面请求")
        
        # 从httpOnly cookie获取认证信息
        auth_token = request.cookies.get("auth_token")
        user_uuid = request.cookies.get("user_uuid")
        user_email = request.cookies.get("user_email")
        
        logger.info(f"🔍 PRICING: 检查认证cookie状态")
        logger.info(f"   - auth_token存在: {bool(auth_token)}")
        logger.info(f"   - user_uuid: {user_uuid}")
        logger.info(f"   - user_email: {user_email}")
        
        if not auth_token or not user_uuid:
            logger.info("❌ PRICING: 用户未登录，返回默认套餐信息")
            return {
                "is_logged_in": False,
                "current_level": None,
                "available_plans": ["free", "base", "pro", "max"],
                "message": "用户未登录"
            }
        
        # 验证token
        try:
            payload = verify_access_token(auth_token)
            if not payload:
                logger.info("❌ PRICING: Token验证失败")
                return {
                    "is_logged_in": False,
                    "current_level": None,
                    "available_plans": ["free", "base", "pro", "max"],
                    "message": "Token验证失败"
                }
            
            user_id = payload.get("user_id")
            if not user_id:
                logger.info("❌ PRICING: Token中无用户ID")
                return {
                    "is_logged_in": False,
                    "current_level": None,
                    "available_plans": ["free", "base", "pro", "max"],
                    "message": "Token中无用户ID"
                }
            
            # 从数据库获取用户信息
            user = await db_service.get_user_by_id(user_id)
            if not user:
                logger.info(f"❌ PRICING: 数据库中未找到用户 {user_id}")
                return {
                    "is_logged_in": False,
                    "current_level": None,
                    "available_plans": ["free", "base", "pro", "max"],
                    "message": "数据库中未找到用户"
                }
            
            # 🎯 详细记录用户level信息 - 专门为PRICING页面
            user_level = user.get("level", "free")
            logger.info(f"🎯 PRICING: ===========================================")
            logger.info(f"🎯 PRICING: 用户等级详细信息")
            logger.info(f"🎯 PRICING: ===========================================")
            logger.info(f"🎯 PRICING: 用户邮箱: {user['email']}")
            logger.info(f"🎯 PRICING: 用户ID: {user['id']}")
            logger.info(f"🎯 PRICING: 用户UUID: {user.get('uuid', 'N/A')}")
            logger.info(f"🎯 PRICING: 数据库原始level: {repr(user.get('level'))}")
            logger.info(f"🎯 PRICING: Level数据类型: {type(user.get('level'))}")
            logger.info(f"🎯 PRICING: 最终使用level: {user_level}")
            logger.info(f"🎯 PRICING: 用户积分: {user.get('points', 0)}")
            logger.info(f"🎯 PRICING: ===========================================")
            
            # 构建返回信息
            pricing_info = {
                "is_logged_in": True,
                "current_level": user_level,
                "available_plans": ["free", "base", "pro", "max"],
                "user_info": {
                    "id": str(user["id"]),
                    "email": user["email"],
                    "username": user.get("username", user["email"].split("@")[0]),
                    "level": user_level,
                    "points": user.get("points", 0),
                    "image_url": user.get("image_url")
                },
                "message": f"用户等级: {user_level}"
            }
            
            logger.info(f"✅ PRICING: 成功返回用户定价信息，当前等级: {user_level}")
            return pricing_info
            
        except Exception as token_error:
            logger.error(f"❌ PRICING: Token验证异常: {token_error}")
            return {
                "is_logged_in": False,
                "current_level": None,
                "available_plans": ["free", "base", "pro", "max"],
                "message": "Token验证异常"
            }
            
    except Exception as e:
        logger.error(f"❌ PRICING: 获取定价信息异常: {e}")
        return {
            "is_logged_in": False,
            "current_level": None,
            "available_plans": ["free", "base", "pro", "max"],
            "message": "服务器内部错误"
        }

@router.get("/api/auth/check-status")
async def check_auth_status(request: Request):
    """检查用户认证状态（基于httpOnly cookie）"""
    try:
        # 从httpOnly cookie获取认证信息
        auth_token = request.cookies.get("auth_token")
        user_uuid = request.cookies.get("user_uuid")
        user_email = request.cookies.get("user_email")
        
        logger.info(f"🔍 Auth check - token: {bool(auth_token)}, uuid: {bool(user_uuid)}, email: {bool(user_email)}")
        
        if not auth_token or not user_uuid:
            logger.info("❌ No valid auth cookies found")
            return {
                "is_logged_in": False,
                "status": "logged_out",
                "message": "No valid authentication cookies"
            }
        
        # 验证token
        try:
            payload = verify_access_token(auth_token)
            if not payload:
                logger.info("❌ Invalid auth token")
                return {
                    "is_logged_in": False,
                    "status": "logged_out",
                    "message": "Invalid authentication token"
                }
            
            user_id = payload.get("user_id")
            if not user_id:
                logger.info("❌ No user_id in token")
                return {
                    "is_logged_in": False,
                    "status": "logged_out",
                    "message": "Invalid token payload"
                }
            
            # 从数据库获取完整用户信息
            from services.db_service import db_service
            user = await db_service.get_user_by_id(user_id)
            if not user:
                logger.info(f"❌ User {user_id} not found in database")
                return {
                    "is_logged_in": False,
                    "status": "logged_out",
                    "message": "User not found"
                }
            
            # 🎯 详细记录用户level信息
            user_level = user.get("level", "free")
            logger.info(f"🔍 PRICING: User level details for {user['email']}:")
            logger.info(f"   - Raw level from database: {repr(user.get('level'))}")
            logger.info(f"   - Level type: {type(user.get('level'))}")
            logger.info(f"   - Final level (with fallback): {user_level}")
            logger.info(f"   - User ID: {user['id']}")
            logger.info(f"   - User UUID: {user.get('uuid', 'N/A')}")
            
            # 构建用户信息
            user_info = {
                "id": str(user["id"]),
                "username": user["username"],
                "email": user["email"],
                "image_url": user.get("image_url"),
                "provider": user.get("provider"),
                "level": user_level,
                "created_at": user.get("created_at").isoformat() if user.get("created_at") else None,
                "updated_at": user.get("updated_at").isoformat() if user.get("updated_at") else None,
            }
            
            logger.info(f"✅ Auth check successful for user {user_id} ({user['email']}) with level: {user_level}")
            logger.info(f"🎯 PRICING: Returning user_info.level = {user_info['level']}")
            
            return {
                "is_logged_in": True,
                "status": "logged_in",
                "user_info": user_info,
                "token": auth_token  # 返回token以便前端同步
            }
            
        except Exception as token_error:
            logger.error(f"❌ Token verification error: {token_error}")
            return {
                "is_logged_in": False,
                "status": "logged_out",
                "message": "Token verification failed"
            }
            
    except Exception as e:
        logger.error(f"❌ Auth status check error: {e}")
        return {
            "is_logged_in": False,
            "status": "logged_out",
            "message": "Auth check failed"
        }


# Google OAuth配置
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://www.magicart.cc")
LOCALHOST_REDIRECT_URI = os.getenv("LOCALHOST_REDIRECT_URI", "http://127.0.0.1:8000")

# 验证环境变量
if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
    logger.warn("❌ Google OAuth credentials not found. Please check .env file.")
else:
    logger.info("✅ Google OAuth credentials loaded successfully")


def get_redirect_uri(request: Request) -> str:
    """根据请求动态确定重定向URI"""
    host = request.headers.get("host", "")
    scheme = request.url.scheme
    
    # 如果是本地开发环境，使用固定的localhost URL
    if "localhost" in host or "127.0.0.1" in host:
        logger.info(f"Local development detected, using {LOCALHOST_REDIRECT_URI}")
        return LOCALHOST_REDIRECT_URI
    
    # 生产环境或其他情况，使用配置的重定向URI
    logger.info(f"Production environment detected, using {GOOGLE_REDIRECT_URI}")
    return GOOGLE_REDIRECT_URI

# JWT密钥（生产环境应该使用环境变量）
# 确保JWT_SECRET一致性：优先使用环境变量，如果没有则使用固定值
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # 如果没有环境变量，使用一个固定的默认值（生产环境中应该设置环境变量）
    JWT_SECRET = "default_jwt_secret_for_development_only_change_in_production"
JWT_ALGORITHM = "HS256"

# 存储设备授权码和状态的内存缓存（生产环境应使用Redis）
device_codes: Dict[str, dict] = {}
auth_states: Dict[str, dict] = {}


def generate_device_code() -> str:
    """生成设备授权码"""
    return secrets.token_urlsafe(16)


def generate_state() -> str:
    """生成OAuth state参数"""
    return secrets.token_urlsafe(32)


def cleanup_expired_codes():
    """清理过期的设备码"""
    current_time = datetime.utcnow()
    expired_codes = []
    
    for code, info in device_codes.items():
        # 删除过期的设备码
        if current_time > info["expires_at"]:
            expired_codes.append(code)
        # 删除完成超过1小时的设备码
        elif info.get("completed_at") and current_time > info["completed_at"] + timedelta(hours=1):
            expired_codes.append(code)
    
    for code in expired_codes:
        del device_codes[code]


def create_access_token(user_info: dict, expires_days: int = 30) -> str:
    """创建访问令牌"""
    now = datetime.utcnow()
    payload = {
        "user_id": user_info["id"],
        "uuid": user_info.get("uuid"),  # 用户UUID
        "email": user_info["email"],
        "username": user_info.get("username", user_info.get("name", user_info["email"])),
        "iat": now,  # 签发时间
        "exp": now + timedelta(days=expires_days),  # 过期时间
        "type": "access_token"  # token类型
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_access_token(token: str) -> Optional[dict]:
    """验证访问令牌"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@router.post("/api/device/auth")
async def start_device_auth():
    """启动设备授权流程"""
    # 清理过期的设备码
    cleanup_expired_codes()
    
    device_code = generate_device_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    device_codes[device_code] = {
        "status": "pending",
        "expires_at": expires_at,
        "created_at": datetime.utcnow()
    }
    
    return {
        "status": "success",
        "code": device_code,
        "expires_at": expires_at.isoformat(),
        "message": "请在浏览器中完成登录"
    }


@router.get("/api/device/poll")
async def poll_device_auth(code: str = Query(...)):
    """轮询设备授权状态"""
    if code not in device_codes:
        raise HTTPException(status_code=404, detail="Invalid device code")
    
    device_info = device_codes[code]
    
    # 检查是否过期
    if datetime.utcnow() > device_info["expires_at"]:
        del device_codes[code]
        return {"status": "expired", "message": "授权码已过期"}
    
    if device_info["status"] == "authorized":
        # 返回令牌和用户信息
        token = device_info["token"]
        user_info = device_info["user_info"]
        
        # 清理设备码
        del device_codes[code]
        
        return {
            "status": "authorized",
            "token": token,
            "user_info": user_info
        }
    
    return {"status": "pending", "message": "等待用户授权"}


@router.get("/auth/device")
async def device_auth_redirect(request: Request, code: str = Query(...)):
    """设备授权重定向到Google OAuth"""
    if code not in device_codes:
        raise HTTPException(status_code=404, detail="Invalid device code")
    
    # 动态获取重定向URI
    redirect_uri = get_redirect_uri(request)
    
    # 生成OAuth state并关联到设备码
    state = generate_state()
    auth_states[state] = {
        "device_code": code,
        "created_at": datetime.utcnow(),
        "redirect_uri": redirect_uri  # 保存重定向URI用于回调时使用
    }
    
    # 构建Google OAuth URL
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{redirect_uri}/auth/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent"
    }
    
    google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlparse.urlencode(params)}"
    
    return RedirectResponse(url=google_oauth_url)


@router.get("/auth/callback")
async def oauth_callback(code: str = Query(...), state: str = Query(...), error: str = Query(None)):
    """Google OAuth回调处理，处理从首页来的回调"""
    # 获取保存的重定向URI，如果没有则使用默认值
    redirect_base = GOOGLE_REDIRECT_URI
    if state in auth_states:
        redirect_base = auth_states[state].get("redirect_uri", GOOGLE_REDIRECT_URI)
    
    if error:
        # 重定向到相应环境的首页并带上错误信息
        return RedirectResponse(url=f"{redirect_base}?auth_error={error}")
    
    if state not in auth_states:
        return RedirectResponse(url=f"{redirect_base}?auth_error=invalid_state")
    
    device_code = auth_states[state]["device_code"]
    auth_redirect_uri = auth_states[state]["redirect_uri"]
    del auth_states[state]
    
    if device_code not in device_codes:
        return RedirectResponse(url=f"{redirect_base}?auth_error=expired_code")
    
    try:
        logger.info(f"Processing device OAuth callback with code: {code[:10]}..., state: {state[:10]}...")
        logger.info(f"Device code: {device_code}, redirect_uri: {auth_redirect_uri}")
        
        # 交换访问令牌，配置超时和连接限制
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, limits=HTTP_LIMITS) as client:
            # 增强的重试机制：最多重试5次，适应国内网络环境
            max_retries = 5
            token_response = None
            
            # 首先测试网络连通性
            connectivity_ok = await test_google_connectivity()
            if not connectivity_ok:
                logger.error("Google API is not accessible for device OAuth, network connectivity issue")
                return RedirectResponse(url=f"{redirect_base}?auth_error=network_unreachable&detail=Google_API_not_accessible")
            
            for attempt in range(max_retries):
                try:
                    start_time = asyncio.get_event_loop().time()
                    token_response = await client.post(
                        "https://oauth2.googleapis.com/token",
                        data={
                            "client_id": GOOGLE_CLIENT_ID,
                            "client_secret": GOOGLE_CLIENT_SECRET,
                            "code": code,
                            "grant_type": "authorization_code",
                            "redirect_uri": f"{auth_redirect_uri}/auth/callback"
                        }
                    )
                    elapsed = asyncio.get_event_loop().time() - start_time
                    logger.info(f"Device OAuth token request successful in {elapsed:.2f}s on attempt {attempt + 1}")
                    break
                except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as e:
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if attempt < max_retries - 1:
                        wait_time = min(2 ** attempt, 10)
                        logger.warning(f"Device OAuth token request timeout after {elapsed:.2f}s (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {type(e).__name__}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Device OAuth token request failed after {max_retries} attempts, total time: {elapsed:.2f}s, error: {type(e).__name__}")
                        return RedirectResponse(url=f"{redirect_base}?auth_error=network_timeout&detail=Google_API_timeout_after_{max_retries}_attempts")
                except Exception as e:
                    logger.error(f"Unexpected error during device OAuth token request (attempt {attempt + 1}): {type(e).__name__}: {e}")
                    if attempt == max_retries - 1:
                        return RedirectResponse(url=f"{redirect_base}?auth_error=token_request_failed&detail={str(e)[:100]}")
                    await asyncio.sleep(1)
            
            if token_response is None:
                logger.error("Device OAuth token request failed: no response received")
                return RedirectResponse(url=f"{redirect_base}?auth_error=token_request_failed&detail=No_response")
            
            logger.info(f"Device OAuth token response status: {token_response.status_code}")
            
            if token_response.status_code != 200:
                error_detail = token_response.text
                logger.error(f"Device OAuth token exchange failed: {error_detail}")
                return RedirectResponse(url=f"{redirect_base}?auth_error=token_failed&detail={error_detail[:100]}")
            
            token_data = token_response.json()
            access_token = token_data["access_token"]
            
            # 获取用户信息，重试机制
            user_response = None
            for attempt in range(max_retries):
                try:
                    start_time = asyncio.get_event_loop().time()
                    user_response = await client.get(
                        f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}"
                    )
                    elapsed = asyncio.get_event_loop().time() - start_time
                    logger.info(f"Device OAuth userinfo request successful in {elapsed:.2f}s on attempt {attempt + 1}")
                    break
                except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as e:
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if attempt < max_retries - 1:
                        wait_time = min(2 ** attempt, 10)
                        logger.warning(f"Device OAuth userinfo request timeout after {elapsed:.2f}s (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {type(e).__name__}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Device OAuth userinfo request failed after {max_retries} attempts, total time: {elapsed:.2f}s, error: {type(e).__name__}")
                        return RedirectResponse(url=f"{redirect_base}?auth_error=network_timeout&detail=Userinfo_API_timeout_after_{max_retries}_attempts")
                except Exception as e:
                    logger.error(f"Unexpected error during device OAuth userinfo request (attempt {attempt + 1}): {type(e).__name__}: {e}")
                    if attempt == max_retries - 1:
                        return RedirectResponse(url=f"{redirect_base}?auth_error=userinfo_request_failed&detail={str(e)[:100]}")
                    await asyncio.sleep(1)
            
            if user_response is None:
                logger.error("Device OAuth userinfo request failed: no response received")
                return RedirectResponse(url=f"{redirect_base}?auth_error=userinfo_request_failed&detail=No_response")
            
            if user_response.status_code != 200:
                error_detail = user_response.text
                logger.error(f"Device OAuth failed to get user info: {error_detail}")
                return RedirectResponse(url=f"{redirect_base}?auth_error=userinfo_failed&detail={error_detail[:100]}")
            
            user_data = user_response.json()
            logger.info(f"Device OAuth completed for user: {user_data.get('email')}")
            
            # 检查用户是否存在，不存在则创建新用户
            user_result = await db_service.get_or_create_user(
                email=user_data["email"],
                username=user_data.get("name", user_data["email"]),
                provider="google",
                google_id=user_data["id"],
                image_url=user_data.get("picture")
            )
            
            db_user = user_result["user"]
            is_new_user = user_result["is_new"]
            welcome_message = user_result["message"]
            
            logger.info(f"Device OAuth user processing completed: user_id={db_user['id']}, is_new={is_new_user}")
            
            # 处理邀请码奖励（仅对新用户）
            invitation_result = None
            if is_new_user:
                # 从URL参数中获取邀请码
                invite_code = request.query_params.get('invite_code', '').strip()
                if invite_code:
                    logger.info(f"Processing invite code {invite_code} for new user {db_user['email']} (device OAuth)")
                    
                    # 获取用户IP和设备信息
                    client_ip = request.client.host if request.client else None
                    user_agent = request.headers.get('user-agent', '')
                    device_fingerprint = request.headers.get('x-device-fingerprint', '')
                    
                    # 处理邀请注册
                    invitation_result = await invite_service.process_invitation_registration(
                        invite_code=invite_code,
                        invitee_email=db_user['email'],
                        invitee_id=db_user['id'],
                        invitee_uuid=db_user['uuid'],
                        registration_ip=client_ip,
                        registration_user_agent=user_agent,
                        device_fingerprint=device_fingerprint
                    )
                    
                    if invitation_result and invitation_result.get('success'):
                        logger.info(f"Successfully processed invitation for {db_user['email']} (device OAuth): {invitation_result}")
                        # 更新欢迎消息
                        welcome_message = f"Welcome! You've received {invitation_result['invitee_points_awarded']} bonus points from {invitation_result['inviter_nickname']}'s invitation."
                    else:
                        logger.warning(f"Failed to process invitation for {db_user['email']} (device OAuth): {invitation_result}")
            
            # 构建包含数据库用户信息的用户信息
            user_info = {
                "id": db_user["id"],  # 使用数据库中的用户ID
                "uuid": db_user["uuid"],  # 用户UUID
                "google_id": user_data["id"],  # 保留Google ID用于关联
                "username": db_user["nickname"],
                "email": db_user["email"],
                "image_url": user_data.get("picture"),
                "provider": "google",
                "points": db_user["points"],
                "level": db_user["level"],  # 用户等级
                "is_new": is_new_user,
                "welcome_message": welcome_message,
                "created_at": db_user["ctime"],
                "updated_at": db_user["mtime"]
            }
            
            # 创建应用访问令牌
            app_token = create_access_token(user_info)
            
            # 更新设备码状态
            device_codes[device_code].update({
                "status": "authorized",
                "token": app_token,
                "user_info": user_info
            })
            
            # 创建重定向响应并设置cookie
            response = RedirectResponse(url=f"{redirect_base}?auth_success=true&device_code={device_code}")
            
            # 🔧 优化Cookie设置，提高跨窗口兼容性
            is_secure = redirect_base.startswith("https://")
            is_localhost = "localhost" in redirect_base or "127.0.0.1" in redirect_base
            
            # 设置用户认证相关的cookie（30天过期）
            cookie_kwargs = {
                "max_age": 30 * 24 * 60 * 60,  # 30天
                "secure": is_secure and not is_localhost,  # localhost下不强制HTTPS
                "samesite": "lax"  # 保持lax以支持跨窗口访问
            }
            
            # 在localhost环境下，不设置domain让cookie对所有端口生效
            if not is_localhost:
                cookie_kwargs["domain"] = urlparse.urlparse(redirect_base).hostname
            
            response.set_cookie(
                key="auth_token",
                value=app_token,
                httponly=True,  # 防止XSS攻击
                **cookie_kwargs
            )
            response.set_cookie(
                key="user_uuid", 
                value=user_info["uuid"],
                httponly=False,  # 允许JavaScript读取UUID用于前端显示
                **cookie_kwargs
            )
            response.set_cookie(
                key="user_email",
                value=user_info["email"], 
                httponly=False,
                **cookie_kwargs
            )
            
            return response
            
    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as e:
        logger.error(f"Device OAuth callback network timeout: {str(e)}")
        return RedirectResponse(url=f"{redirect_base}?auth_error=network_timeout&detail=Connection_timeout")
    except Exception as e:
        logger.error(f"Device OAuth callback processing failed: {str(e)}", exc_info=True)
        return RedirectResponse(url=f"{redirect_base}?auth_error=processing_failed&detail={str(e)[:100]}")


@router.get("/api/device/complete")
async def complete_auth(device_code: str = Query(...)):
    """完成认证，获取令牌和用户信息"""
    if device_code not in device_codes:
        raise HTTPException(status_code=404, detail="Invalid device code")
    
    device_info = device_codes[device_code]
    
    if device_info["status"] == "authorized" or device_info["status"] == "completed":
        # 返回令牌和用户信息
        token = device_info["token"]
        user_info = device_info["user_info"]
        
        # 如果是第一次调用，标记为已使用
        if device_info["status"] == "authorized":
            device_codes[device_code]["status"] = "completed"
            device_codes[device_code]["completed_at"] = datetime.utcnow()
        
        return {
            "status": "authorized",
            "token": token,
            "user_info": user_info
        }
    
    return {"status": device_info["status"], "message": "认证未完成"}



@router.get("/auth/login")
async def direct_login(request: Request):
    """直接登录：在当前窗口跳转到Google OAuth"""
    # 动态获取重定向URI
    redirect_uri = get_redirect_uri(request)
    
    # 生成OAuth state参数
    state = generate_state()
    
    # 构建Google OAuth URL
    callback_uri = f"{redirect_uri}/auth/callback/direct"
    logger.info(f"Building Google OAuth URL with callback: {callback_uri}")
    
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": callback_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "consent"
    }
    
    google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlparse.urlencode(params)}"
    
    return RedirectResponse(url=google_oauth_url)


@router.get("/auth/callback/direct")
async def direct_oauth_callback(request: Request, code: str = Query(...), state: str = Query(...), error: str = Query(None)):
    """直接OAuth回调处理：在URL中传递认证结果"""
    # 动态获取重定向URI
    logger.info(f"request: {request}")
    redirect_uri = get_redirect_uri(request)
    
    if error:
        return RedirectResponse(url=f"{redirect_uri}?auth_error={error}")
    
    try:
        logger.info(f"Processing OAuth callback with code: {code[:10]}..., state: {state[:10]}...")
        logger.info(f"Using redirect_uri: {redirect_uri}")
        
        # 交换访问令牌，配置超时和连接限制
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT, limits=HTTP_LIMITS) as client:
            token_url = "https://oauth2.googleapis.com/token"
            token_data_payload = {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": f"{redirect_uri}/auth/callback/direct"
            }
            
            logger.info(f"Requesting token from Google with redirect_uri: {token_data_payload['redirect_uri']}")
            
            # 增强的重试机制：最多重试5次，适应国内网络环境
            max_retries = 5
            token_response = None
            
            # 首先测试网络连通性
            connectivity_ok = await test_google_connectivity()
            if not connectivity_ok:
                logger.error("Google API is not accessible, network connectivity issue")
                return RedirectResponse(url=f"{redirect_uri}?auth_error=network_unreachable&detail=Google_API_not_accessible")
            
            for attempt in range(max_retries):
                try:
                    start_time = asyncio.get_event_loop().time()
                    token_response = await client.post(token_url, data=token_data_payload)
                    elapsed = asyncio.get_event_loop().time() - start_time
                    logger.info(f"Token request successful in {elapsed:.2f}s on attempt {attempt + 1}")
                    break  # 成功则退出循环
                except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as e:
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if attempt < max_retries - 1:
                        wait_time = min(2 ** attempt, 10)  # 指数退避，最多10秒
                        logger.warning(f"Token request timeout after {elapsed:.2f}s (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {type(e).__name__}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Token request failed after {max_retries} attempts, total time: {elapsed:.2f}s, error: {type(e).__name__}")
                        return RedirectResponse(url=f"{redirect_uri}?auth_error=network_timeout&detail=Google_API_timeout_after_{max_retries}_attempts")
                except Exception as e:
                    logger.error(f"Unexpected error during token request (attempt {attempt + 1}): {type(e).__name__}: {e}")
                    if attempt == max_retries - 1:
                        return RedirectResponse(url=f"{redirect_uri}?auth_error=token_request_failed&detail={str(e)[:100]}")
                    await asyncio.sleep(1)
            
            if token_response is None:
                logger.error("Token request failed: no response received")
                return RedirectResponse(url=f"{redirect_uri}?auth_error=token_request_failed&detail=No_response")
            
            logger.info(f"Google token response status: {token_response.status_code}")
            
            if token_response.status_code != 200:
                error_detail = token_response.text
                logger.error(f"Token exchange failed: {error_detail}")
                return RedirectResponse(url=f"{redirect_uri}?auth_error=token_failed&detail={error_detail[:100]}")
            
            token_data = token_response.json()
            access_token = token_data["access_token"]
            
            logger.info("Successfully obtained access token from Google")
            
            # 获取用户信息，重试机制
            user_response = None
            for attempt in range(max_retries):
                try:
                    start_time = asyncio.get_event_loop().time()
                    user_response = await client.get(
                        f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}"
                    )
                    elapsed = asyncio.get_event_loop().time() - start_time
                    logger.info(f"Userinfo request successful in {elapsed:.2f}s on attempt {attempt + 1}")
                    break
                except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as e:
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if attempt < max_retries - 1:
                        wait_time = min(2 ** attempt, 10)
                        logger.warning(f"Userinfo request timeout after {elapsed:.2f}s (attempt {attempt + 1}/{max_retries}), retrying in {wait_time}s: {type(e).__name__}")
                        await asyncio.sleep(wait_time)
                    else:
                        logger.error(f"Userinfo request failed after {max_retries} attempts, total time: {elapsed:.2f}s, error: {type(e).__name__}")
                        return RedirectResponse(url=f"{redirect_uri}?auth_error=network_timeout&detail=Userinfo_API_timeout_after_{max_retries}_attempts")
                except Exception as e:
                    logger.error(f"Unexpected error during userinfo request (attempt {attempt + 1}): {type(e).__name__}: {e}")
                    if attempt == max_retries - 1:
                        return RedirectResponse(url=f"{redirect_uri}?auth_error=userinfo_request_failed&detail={str(e)[:100]}")
                    await asyncio.sleep(1)
            
            if user_response is None:
                logger.error("Userinfo request failed: no response received")
                return RedirectResponse(url=f"{redirect_uri}?auth_error=userinfo_request_failed&detail=No_response")
            
            logger.info(f"Google userinfo response status: {user_response.status_code}")
            
            if user_response.status_code != 200:
                error_detail = user_response.text
                logger.error(f"Failed to get user info: {error_detail}")
                return RedirectResponse(url=f"{redirect_uri}?auth_error=userinfo_failed&detail={error_detail[:100]}")
            
            user_data = user_response.json()
            logger.info(f"Successfully obtained user info for: {user_data.get('email')}")
            
            # 检查用户是否存在，不存在则创建新用户
            user_result = await db_service.get_or_create_user(
                email=user_data["email"],
                username=user_data.get("name", user_data["email"]),
                provider="google",
                google_id=user_data["id"],
                image_url=user_data.get("picture")
            )
            
            db_user = user_result["user"]
            is_new_user = user_result["is_new"]
            welcome_message = user_result["message"]
            
            logger.info(f"User processing completed: user_id={db_user['id']}, is_new={is_new_user}")
            
            # 处理邀请码奖励（仅对新用户）
            invitation_result = None
            if is_new_user:
                # 优先从state参数中获取邀请码（格式：invite_CODE），如果没有则从URL参数获取
                invite_code = ''
                if state and state.startswith('invite_'):
                    invite_code = state[7:]  # 去掉 'invite_' 前缀
                    logger.info(f"Extracted invite code from state: {invite_code}")
                else:
                    invite_code = request.query_params.get('invite_code', '').strip()
                    if invite_code:
                        logger.info(f"Found invite code in URL params: {invite_code}")
                
                if invite_code:
                    logger.info(f"Processing invite code {invite_code} for new user {db_user['email']} (direct callback)")
                    
                    # 获取用户IP和设备信息
                    client_ip = request.client.host if request.client else None
                    user_agent = request.headers.get('user-agent', '')
                    device_fingerprint = request.headers.get('x-device-fingerprint', '')
                    
                    # 处理邀请注册
                    invitation_result = await invite_service.process_invitation_registration(
                        invite_code=invite_code,
                        invitee_email=db_user['email'],
                        invitee_id=db_user['id'],
                        invitee_uuid=db_user['uuid'],
                        registration_ip=client_ip,
                        registration_user_agent=user_agent,
                        device_fingerprint=device_fingerprint
                    )
                    
                    if invitation_result and invitation_result.get('success'):
                        logger.info(f"Successfully processed invitation for {db_user['email']}: {invitation_result}")
                        # 更新欢迎消息
                        welcome_message = f"Welcome! You've received {invitation_result['invitee_points_awarded']} bonus points from {invitation_result['inviter_nickname']}'s invitation."
                    else:
                        logger.warning(f"Failed to process invitation for {db_user['email']}: {invitation_result}")
            
            # 构建包含数据库用户信息的用户信息
            user_info = {
                "id": db_user["id"],  # 使用数据库中的用户ID
                "uuid": db_user["uuid"],  # 用户UUID
                "google_id": user_data["id"],  # 保留Google ID用于关联
                "username": db_user["nickname"],
                "email": db_user["email"],
                "image_url": user_data.get("picture"),
                "provider": "google",
                "points": db_user["points"],
                "level": db_user["level"],  # 用户等级
                "is_new": is_new_user,
                "welcome_message": welcome_message,
                "created_at": db_user["ctime"],
                "updated_at": db_user["mtime"]
            }
            
            # 创建应用访问令牌
            app_token = create_access_token(user_info)
            
            # 将认证信息编码到URL参数中
            import base64
            import json
            auth_data = {
                "token": app_token,
                "user_info": user_info
            }
            encoded_data = base64.urlsafe_b64encode(json.dumps(auth_data).encode()).decode()
            
            logger.info("OAuth authentication completed successfully")
            
            # 创建重定向响应并设置cookie
            response = RedirectResponse(url=f"{redirect_uri}?auth_success=true&auth_data={encoded_data}")
            
            # 🔧 优化Cookie设置，提高跨窗口兼容性
            is_secure = redirect_uri.startswith("https://")
            is_localhost = "localhost" in redirect_uri or "127.0.0.1" in redirect_uri
            
            # 设置用户认证相关的cookie（30天过期）
            cookie_kwargs = {
                "max_age": 30 * 24 * 60 * 60,  # 30天
                "secure": is_secure and not is_localhost,  # localhost下不强制HTTPS
                "samesite": "lax"  # 保持lax以支持跨窗口访问
            }
            
            # 在localhost环境下，不设置domain让cookie对所有端口生效
            if not is_localhost:
                cookie_kwargs["domain"] = urlparse.urlparse(redirect_uri).hostname
            
            response.set_cookie(
                key="auth_token",
                value=app_token,
                httponly=True,  # 防止XSS攻击
                **cookie_kwargs
            )
            response.set_cookie(
                key="user_uuid", 
                value=user_info["uuid"],
                httponly=False,  # 允许JavaScript读取UUID用于前端显示
                **cookie_kwargs
            )
            response.set_cookie(
                key="user_email",
                value=user_info["email"], 
                httponly=False,
                **cookie_kwargs
            )
            
            return response
            
    except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.TimeoutException) as e:
        logger.error(f"OAuth callback network timeout: {str(e)}")
        return RedirectResponse(url=f"{redirect_uri}?auth_error=network_timeout&detail=Connection_timeout")
    except Exception as e:
        logger.error(f"OAuth callback processing failed: {str(e)}", exc_info=True)
        return RedirectResponse(url=f"{redirect_uri}?auth_error=processing_failed&detail={str(e)[:100]}")


@router.get("/api/device/refresh-token")
async def refresh_token(request: Request):
    """刷新访问令牌 - 智能刷新，支持即将过期的token"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    
    try:
        # 尝试验证当前令牌（包括过期的token）
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
        
        # 检查token类型
        if payload.get("type") != "access_token":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # 检查是否是真正过期的token（超过过期时间1小时以上的token拒绝刷新）
        exp_timestamp = payload.get("exp")
        if exp_timestamp:
            exp_time = datetime.fromtimestamp(exp_timestamp)
            current_time = datetime.utcnow()
            
            # 如果token过期超过1小时，拒绝刷新
            if current_time > exp_time + timedelta(hours=1):
                raise HTTPException(status_code=401, detail="Token expired too long ago, please login again")
        
        # 创建新令牌
        user_info = {
            "id": payload["user_id"],
            "email": payload["email"],
            "username": payload.get("username", payload["email"])
        }
        
        new_token = create_access_token(user_info)
        
        return {
            "new_token": new_token,
            "expires_in": 30 * 24 * 60 * 60,  # 30天，以秒为单位
            "token_type": "Bearer"
        }
        
    except jwt.InvalidTokenError as e:
        # Token格式无效或其他JWT错误
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except Exception as e:
        # 其他错误
        raise HTTPException(status_code=500, detail="Token refresh failed")


def clear_auth_cookies(response: Response, request: Request = None):
    """清除所有认证相关的cookie的通用函数"""
    cookie_keys = ["auth_token", "user_uuid", "user_email"]
    
    # 判断是否为HTTPS环境
    is_secure = False
    if request:
        redirect_uri = get_redirect_uri(request)
        is_secure = redirect_uri.startswith("https://")
    
    logger.info("🧹 Backend: Clearing auth cookies...")
    logger.info(f"🔍 Backend: Clearing cookies: {cookie_keys}")
    logger.info(f"🔍 Backend: is_secure={is_secure}")
    
    for key in cookie_keys:
        logger.info(f"🗑️ Backend: Deleting cookie: {key}")
        
        # 先记录要删除的cookie的当前状态
        current_value = request.cookies.get(key) if request else None
        logger.info(f"🔍 Backend: Cookie {key} current value: {current_value[:20] if current_value else 'None'}...")
        
        # 1. 清除时使用与设置时完全相同的参数
        if key == "auth_token":
            # auth_token 是 httponly=True
            logger.info(f"🗑️ Backend: Deleting {key} with httponly=True")
            response.delete_cookie(
                key=key, 
                path="/",
                secure=is_secure,
                samesite="lax",
                httponly=True  # 重要：必须匹配设置时的参数
            )
        else:
            # user_uuid 和 user_email 是 httponly=False
            logger.info(f"🗑️ Backend: Deleting {key} with httponly=False")
            response.delete_cookie(
                key=key, 
                path="/",
                secure=is_secure,
                samesite="lax",
                httponly=False
            )
        
        # 2. 为了确保清除，也尝试其他可能的参数组合
        logger.info(f"🗑️ Backend: Trying additional delete combinations for {key}")
        response.delete_cookie(key=key)
        response.delete_cookie(key=key, path="/")
        response.delete_cookie(key=key, path="/", secure=True, samesite="lax")
        response.delete_cookie(key=key, path="/", secure=False, samesite="lax")
        response.delete_cookie(key=key, path="/", secure=True, samesite="lax", httponly=True)
        response.delete_cookie(key=key, path="/", secure=False, samesite="lax", httponly=True)
        response.delete_cookie(key=key, path="/", secure=True, samesite="lax", httponly=False)
        response.delete_cookie(key=key, path="/", secure=False, samesite="lax", httponly=False)
        
        # 3. 尝试不同的path组合（以防设置时使用了不同的path）
        response.delete_cookie(key=key, path="/api")
        response.delete_cookie(key=key, path="")
        
        logger.info(f"✅ Backend: Cookie {key} deletion commands sent (total: 12 attempts)")


@router.post("/api/auth/logout")
async def logout_api(request: Request, response: Response):
    """注销用户，清除所有认证相关的cookie（Ajax API版本）
    
    返回重定向URL，前端需要手动跳转：
    
    示例前端代码：
    ```javascript
    fetch('/api/auth/logout', {method: 'POST', credentials: 'include'})
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                window.location.href = data.redirect_url;
            }
        });
    ```
    """
    logger.info("🚪 === BACKEND LOGOUT API CALLED ===")
    logger.info(f"🔍 Request cookies: {request.cookies}")
    logger.info(f"🔍 Request headers: {dict(request.headers)}")
    
    # 清除所有认证相关的cookie
    clear_auth_cookies(response, request)
    
    # 动态获取重定向URI（首页）
    redirect_uri = get_redirect_uri(request)
    
    logger.info(f"✅ User logged out via API, should redirect to: {redirect_uri}")
    
    return {
        "success": True,
        "message": "Successfully logged out",
        "redirect_url": redirect_uri
    }


@router.get("/logout")  
async def logout_redirect(request: Request):
    """注销用户并直接重定向到首页（页面跳转版本）
    
    用法：
    - 直接在浏览器访问: /logout
    - 或在前端使用: window.location.href = '/logout'
    """
    # 动态获取重定向URI（首页）
    redirect_uri = get_redirect_uri(request)
    
    # 创建重定向响应
    response = RedirectResponse(url=redirect_uri)
    
    # 清除所有认证相关的cookie
    clear_auth_cookies(response, request)
    
    logger.info("User logged out successfully, redirecting to homepage")
    return response


@router.get("/api/network/test")
async def test_network_connectivity():
    """网络连通性测试端点，帮助调试网络问题"""
    results = []
    
    # 测试Google OAuth端点
    start_time = asyncio.get_event_loop().time()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.get("https://oauth2.googleapis.com/token")
        elapsed = asyncio.get_event_loop().time() - start_time
        results.append({
            "endpoint": "Google OAuth Token",
            "url": "https://oauth2.googleapis.com/token",
            "status": "reachable",
            "response_time": f"{elapsed:.2f}s",
            "status_code": response.status_code
        })
    except Exception as e:
        elapsed = asyncio.get_event_loop().time() - start_time
        results.append({
            "endpoint": "Google OAuth Token",
            "url": "https://oauth2.googleapis.com/token", 
            "status": "unreachable",
            "response_time": f"{elapsed:.2f}s",
            "error": str(e)
        })
    
    # 测试Google Userinfo端点
    start_time = asyncio.get_event_loop().time()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            response = await client.get("https://www.googleapis.com/oauth2/v2/userinfo",
                                      headers={"Authorization": "Bearer invalid"})
        elapsed = asyncio.get_event_loop().time() - start_time
        results.append({
            "endpoint": "Google Userinfo API",
            "url": "https://www.googleapis.com/oauth2/v2/userinfo",
            "status": "reachable",
            "response_time": f"{elapsed:.2f}s",
            "status_code": response.status_code
        })
    except Exception as e:
        elapsed = asyncio.get_event_loop().time() - start_time
        results.append({
            "endpoint": "Google Userinfo API",
            "url": "https://www.googleapis.com/oauth2/v2/userinfo",
            "status": "unreachable", 
            "response_time": f"{elapsed:.2f}s",
            "error": str(e)
        })
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "results": results,
        "overall_status": "healthy" if all(r["status"] == "reachable" for r in results) else "degraded"
    }