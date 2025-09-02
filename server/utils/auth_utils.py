"""
用户认证相关工具函数
"""
import jwt
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException
import os
from datetime import datetime

# JWT配置（与auth_router.py保持一致）
import secrets
JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"


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
        print(f"✅ 用户目录已确保存在: {user_email} -> {user_files_dir}")
    elif user_id:
        print(f"✅ 用户目录已确保存在 (向后兼容): {user_id} -> {user_files_dir}")
    else:
        print(f"✅ 匿名用户目录已确保存在: {user_files_dir}")
    
    return user_files_dir