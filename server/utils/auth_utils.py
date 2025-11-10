"""
用户认证相关工具函数
"""
import jwt
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os
from datetime import datetime
from log import get_logger
from services.db_service import db_service

logger = get_logger(__name__)

# JWT配置（与auth_router.py保持一致）
# 使用固定的JWT_SECRET以确保一致性
import secrets
# 确保JWT_SECRET一致性：优先使用环境变量，如果没有则使用固定值
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    # 如果没有环境变量，使用一个固定的默认值（生产环境中应该设置环境变量）
    JWT_SECRET = "default_jwt_secret_for_development_only_change_in_production"
JWT_ALGORITHM = "HS256"

# FastAPI Security scheme
security = HTTPBearer()


def verify_access_token(token: str) -> Optional[dict]:
    """验证访问令牌"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def extract_user_from_request(request: Request) -> Optional[Dict[str, Any]]:
    """从请求中提取用户信息"""
    auth_header = request.headers.get("Authorization", "")
    
    if not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    user_payload = verify_access_token(token)
    
    if not user_payload:
        return None
    
    return {
        "id": user_payload.get("user_id"),
        "email": user_payload.get("email"),
        "username": user_payload.get("username")
    }


def get_user_id_from_request(request: Request) -> Optional[str]:
    """从请求中获取用户ID"""
    user = extract_user_from_request(request)
    return user["id"] if user else None


def get_user_email_from_request(request: Request) -> Optional[str]:
    """从请求中获取用户邮箱"""
    user = extract_user_from_request(request)
    return user["email"] if user else None


def require_auth(request: Request) -> Dict[str, Any]:
    """要求用户认证，如果未认证则抛出异常"""
    user = extract_user_from_request(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def ensure_user_directory_exists(request: Request) -> str:
    """
    确保用户目录存在，返回用户目录路径
    
    如果用户已认证，使用邮箱创建目录；
    如果用户未认证，使用匿名目录。
    
    返回用户文件目录的完整路径
    """
    from services.config_service import get_user_files_dir
    
    user_email = get_user_email_from_request(request)
    user_id = get_user_id_from_request(request)
    
    # 创建并返回用户目录
    user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
    
    # 打印日志以便调试
    if user_email:
        logger.info(f"✅ 用户目录已确保存在: {user_email} -> {user_files_dir}")
    elif user_id:
        logger.info(f"✅ 用户目录已确保存在 (向后兼容): {user_id} -> {user_files_dir}")
    else:
        logger.info(f"✅ 匿名用户目录已确保存在: {user_files_dir}")
    
    return user_files_dir


# 新的基于UUID的用户认证系统

class CurrentUser:
    """当前用户信息类"""
    def __init__(self, id: int, uuid: str, email: str, nickname: str, points: int):
        self.id = id
        self.uuid = uuid  
        self.email = email
        self.nickname = nickname
        self.points = points


async def get_current_user(request: Request) -> CurrentUser:
    """
    从JWT token或cookie获取当前用户信息
    这是FastAPI依赖注入函数，用于所有需要认证的API
    支持从cookie和Authorization header两种方式读取认证信息
    """
    token = None
    
    # 1. 优先尝试从cookie获取token
    auth_token_cookie = request.cookies.get("auth_token")
    if auth_token_cookie:
        token = auth_token_cookie
        logger.info("Using auth token from cookie for required auth")
    else:
        # 2. 备选方案：从Authorization header获取token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Remove "Bearer " prefix
            logger.info("Using auth token from Authorization header for required auth")
    
    if not token:
        # 3. 最后尝试直接从cookie获取UUID（向后兼容）
        user_uuid_cookie = request.cookies.get("user_uuid")
        if user_uuid_cookie:
            logger.info(f"Using UUID directly from cookie for required auth: {user_uuid_cookie}")
            try:
                user_data = await db_service.get_user_by_uuid(user_uuid_cookie)
                if user_data:
                    return CurrentUser(
                        id=user_data["id"],
                        uuid=user_data["uuid"],
                        email=user_data["email"],
                        nickname=user_data["nickname"],
                        points=user_data["points"]
                    )
            except Exception as e:
                logger.warning(f"Failed to get user by UUID from cookie: {e}")
        
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        # 解码JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # 检查token类型
        if payload.get("type") != "access_token":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        # 从token中获取用户UUID
        user_uuid = payload.get("uuid")
        if not user_uuid:
            # 兼容老版本token，使用user_id
            user_id = payload.get("user_id")
            if user_id:
                user_data = await db_service.get_user_by_id(user_id)
            else:
                raise HTTPException(status_code=401, detail="Invalid token: missing user identifier")
        else:
            # 从数据库获取用户信息
            user_data = await db_service.get_user_by_uuid(user_uuid)
        
        if not user_data:
            raise HTTPException(status_code=401, detail="User not found")
        
        return CurrentUser(
            id=user_data["id"],
            uuid=user_data["uuid"],
            email=user_data["email"],
            nickname=user_data["nickname"],
            points=user_data["points"]
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        raise HTTPException(status_code=401, detail="Authentication failed")


async def get_current_user_optional(request: Request) -> Optional[CurrentUser]:
    """
    可选的用户认证：优先从cookie读取，然后尝试Authorization header
    用于那些支持匿名访问但需要区分用户的API
    """
    
    token = None
    
    # 1. 优先尝试从cookie获取token
    auth_token_cookie = request.cookies.get("auth_token")
    if auth_token_cookie:
        token = auth_token_cookie
    else:
        # 2. 备选方案：从Authorization header获取token
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]  # Remove "Bearer " prefix
            logger.info(f"✅ Using auth token from Authorization header: {token[:20]}...")
    
    if not token:
        # 3. 最后尝试直接从cookie获取UUID（向后兼容）
        user_uuid_cookie = request.cookies.get("user_uuid")
        if user_uuid_cookie:
            logger.info(f"Using UUID directly from cookie: {user_uuid_cookie}")
            try:
                user_data = await db_service.get_user_by_uuid(user_uuid_cookie)
                if user_data:
                    return CurrentUser(
                        id=user_data["id"],
                        uuid=user_data["uuid"],
                        email=user_data["email"],
                        nickname=user_data["nickname"],
                        points=user_data["points"]
                    )
            except Exception as e:
                logger.warning(f"Failed to get user by UUID from cookie: {e}")
        
        return None
    
    try:
        # 解码JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # 从token中获取用户UUID
        user_uuid = payload.get("uuid")
        if not user_uuid:
            # 兼容老版本token
            user_id = payload.get("user_id")
            if user_id:
                user_data = await db_service.get_user_by_id(user_id)
            else:
                return None
        else:
            user_data = await db_service.get_user_by_uuid(user_uuid)
        
        if not user_data:
            return None
        
        return CurrentUser(
            id=user_data["id"],
            uuid=user_data["uuid"],
            email=user_data["email"],
            nickname=user_data["nickname"],
            points=user_data["points"]
        )
        
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    except Exception as e:
        logger.warning(f"Optional authentication error: {e}")
        return None


def get_user_uuid_for_database_operations(current_user: Optional[CurrentUser]) -> Optional[str]:
    """
    获取用于数据库操作的用户UUID
    如果用户已认证，返回用户UUID；否则返回None（将使用匿名用户UUID）
    """
    if current_user:
        return current_user.uuid
    else:
        return None  # None将在db_service中转换为匿名用户UUID