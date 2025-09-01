import os
import uuid
import time
import hashlib
import secrets
import urllib.parse as urlparse
from typing import Dict, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response, Query
from fastapi.responses import RedirectResponse
import httpx
import jwt


router = APIRouter()


# Google OAuth配置
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "https://www.magicart.cc")


def get_redirect_uri(request: Request) -> str:
    """根据请求动态确定重定向URI"""
    host = request.headers.get("host", "")
    scheme = request.url.scheme
    
    # 如果是本地开发环境
    if "localhost" in host or "127.0.0.1" in host:
        return f"{scheme}://{host}"
    
    # 生产环境或其他情况，使用配置的重定向URI
    return GOOGLE_REDIRECT_URI

# JWT密钥（生产环境应该使用环境变量）
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
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


def create_access_token(user_info: dict) -> str:
    """创建访问令牌"""
    payload = {
        "user_id": user_info["id"],
        "email": user_info["email"],
        "username": user_info.get("name", user_info["email"]),
        "exp": datetime.utcnow() + timedelta(days=30)
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
        # 交换访问令牌
        async with httpx.AsyncClient() as client:
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
            
            if token_response.status_code != 200:
                return RedirectResponse(url=f"{redirect_base}?auth_error=token_failed")
            
            token_data = token_response.json()
            access_token = token_data["access_token"]
            
            # 获取用户信息
            user_response = await client.get(
                f"https://www.googleapis.com/oauth2/v2/userinfo?access_token={access_token}"
            )
            
            if user_response.status_code != 200:
                return RedirectResponse(url=f"{redirect_base}?auth_error=userinfo_failed")
            
            user_data = user_response.json()
            
            # 构建用户信息
            user_info = {
                "id": user_data["id"],
                "username": user_data.get("name", user_data["email"]),
                "email": user_data["email"],
                "image_url": user_data.get("picture"),
                "provider": "google",
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat()
            }
            
            # 创建应用访问令牌
            app_token = create_access_token(user_info)
            
            # 更新设备码状态
            device_codes[device_code].update({
                "status": "authorized",
                "token": app_token,
                "user_info": user_info
            })
            
            # 重定向到相应环境的首页并带上成功参数
            return RedirectResponse(url=f"{redirect_base}?auth_success=true&device_code={device_code}")
            
    except Exception as e:
        return RedirectResponse(url=f"{redirect_base}?auth_error=processing_failed")


@router.get("/api/device/complete")
async def complete_auth(device_code: str = Query(...)):
    """完成认证，获取令牌和用户信息"""
    if device_code not in device_codes:
        raise HTTPException(status_code=404, detail="Invalid device code")
    
    device_info = device_codes[device_code]
    
    if device_info["status"] == "authorized":
        # 返回令牌和用户信息
        token = device_info["token"]
        user_info = device_info["user_info"]
        
        # 清理设备码
        del device_codes[device_code]
        
        return {
            "status": "authorized",
            "token": token,
            "user_info": user_info
        }
    
    return {"status": device_info["status"], "message": "认证未完成"}


@router.get("/api/device/refresh-token")
async def refresh_token(request: Request):
    """刷新访问令牌"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    
    # 验证当前令牌
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # 创建新令牌
    user_info = {
        "id": payload["user_id"],
        "email": payload["email"],
        "username": payload.get("username", payload["email"])
    }
    
    new_token = create_access_token(user_info)
    
    return {"new_token": new_token}