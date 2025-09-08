from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional
from pydantic import BaseModel
import jwt

from services.invite_service import invite_service
from services.points_service import points_service
from services.db_service import db_service
from routers.auth_router import JWT_SECRET, JWT_ALGORITHM
from log import get_logger

logger = get_logger(__name__)

router = APIRouter()

# Pydantic models for request/response
class InviteCodeResponse(BaseModel):
    success: bool
    code: Optional[str] = None
    used_count: int = 0
    max_uses: int = 500
    remaining_uses: int = 500
    error: Optional[str] = None

class InviteStatsResponse(BaseModel):
    invite_code: Optional[str]
    used_count: int
    max_uses: int
    remaining_uses: int
    total_invitations: int
    successful_invitations: int
    total_points_earned: int
    pending_invitations: int

class ValidateInviteRequest(BaseModel):
    code: str

class ValidateInviteResponse(BaseModel):
    is_valid: bool
    reason: Optional[str] = None
    inviter_nickname: Optional[str] = None


def get_current_user(request: Request) -> Dict[str, Any]:
    """从请求中获取当前用户信息"""
    # 尝试从Authorization header获取token
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        # 尝试从cookie获取token
        token = request.cookies.get("auth_token")
    
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.get("/api/invite/my-code", response_model=InviteCodeResponse)
async def get_my_invite_code(request: Request):
    """获取当前用户的邀请码"""
    try:
        user = get_current_user(request)
        user_id = user.get("user_id")
        user_uuid = user.get("uuid")
        
        if not user_id or not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user information")
        
        result = await invite_service.get_or_create_invite_code(user_id, user_uuid)
        
        return InviteCodeResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting invite code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/api/invite/validate", response_model=ValidateInviteResponse)
async def validate_invite_code(request: ValidateInviteRequest):
    """验证邀请码是否有效"""
    try:
        result = await invite_service.validate_invite_code(request.code)
        
        return ValidateInviteResponse(
            is_valid=result['is_valid'],
            reason=result.get('reason'),
            inviter_nickname=result.get('inviter_nickname')
        )
        
    except Exception as e:
        logger.error(f"Error validating invite code: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/api/invite/stats", response_model=InviteStatsResponse)
async def get_invite_stats(request: Request):
    """获取当前用户的邀请统计信息"""
    try:
        user = get_current_user(request)
        user_uuid = user.get("uuid")
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user information")
        
        stats = await invite_service.get_invitation_stats(user_uuid)
        
        return InviteStatsResponse(**stats)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting invite stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/api/invite/history")
async def get_invite_history(request: Request, limit: int = 20, offset: int = 0):
    """获取当前用户的邀请历史记录"""
    try:
        user = get_current_user(request)
        user_uuid = user.get("uuid")
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user information")
        
        result = await invite_service.get_invitation_history(user_uuid, limit, offset)
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting invite history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/api/points/balance")
async def get_points_balance(request: Request):
    """获取当前用户的积分余额"""
    try:
        user = get_current_user(request)
        user_uuid = user.get("uuid")
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user information")
        
        balance = await points_service.get_user_points_balance(user_uuid)
        
        return {
            "success": True,
            "balance": balance
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting points balance: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/api/points/history")
async def get_points_history(request: Request, limit: int = 50, offset: int = 0):
    """获取当前用户的积分交易历史"""
    try:
        user = get_current_user(request)
        user_uuid = user.get("uuid")
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user information")
        
        history = await points_service.get_points_history(user_uuid, limit, offset)
        
        return {
            "success": True,
            "history": history,
            "total_count": len(history)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting points history: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/api/points/stats")
async def get_points_stats(request: Request):
    """获取当前用户的积分统计信息"""
    try:
        user = get_current_user(request)
        user_uuid = user.get("uuid")
        
        if not user_uuid:
            raise HTTPException(status_code=400, detail="Invalid user information")
        
        stats = await points_service.get_points_stats(user_uuid)
        
        return {
            "success": True,
            "stats": stats
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting points stats: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/invite/{code}")
async def invite_landing_page(code: str, request: Request):
    """邀请链接落地页，验证邀请码并直接重定向到Google OAuth"""
    try:
        # 验证邀请码
        validation = await invite_service.validate_invite_code(code)
        
        if not validation['is_valid']:
            # 邀请码无效，重定向到首页并显示错误
            redirect_uri = request.headers.get("host", "")
            if "localhost" in redirect_uri or "127.0.0.1" in redirect_uri:
                base_url = f"http://{redirect_uri}"
            else:
                base_url = "https://www.magicart.cc"
            
            from fastapi.responses import RedirectResponse
            return RedirectResponse(url=f"{base_url}?invite_error={validation['reason']}")
        
        # 邀请码有效，直接重定向到Google OAuth登录
        # 动态获取重定向URI
        host = request.headers.get("host", "localhost:8000")
        if "localhost" in host or "127.0.0.1" in host:
            redirect_uri = f"http://{host}"
        else:
            redirect_uri = "https://www.magicart.cc"
        
        # 需要导入必要的模块和配置
        from routers.auth_router import GOOGLE_CLIENT_ID
        import urllib.parse as urlparse
        from fastapi.responses import RedirectResponse
        
        # 构建Google OAuth URL，在state中包含邀请码信息
        params = {
            "client_id": GOOGLE_CLIENT_ID,
            "redirect_uri": f"{redirect_uri}/auth/callback/direct",
            "response_type": "code",
            "scope": "openid email profile",
            "state": f"invite_{code}",  # 在state中包含邀请码
            "access_type": "offline",
            "prompt": "consent",
            "invite_code": code  # 额外添加邀请码参数
        }
        
        google_oauth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlparse.urlencode(params)}"
        
        logger.info(f"Redirecting to Google OAuth for invite code {code}: {google_oauth_url}")
        
        return RedirectResponse(url=google_oauth_url)
        
    except Exception as e:
        logger.error(f"Error processing invite landing page for code {code}: {e}")
        # 发生错误时重定向到首页
        host = request.headers.get("host", "localhost:8000")
        if "localhost" in host or "127.0.0.1" in host:
            base_url = f"http://{host}"
        else:
            base_url = "https://www.magicart.cc"
        
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=f"{base_url}?invite_error=server_error")