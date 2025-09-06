from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional
from pydantic import BaseModel

from services.db_service import db_service
from routers.auth_router import verify_access_token
from log import get_logger

logger = get_logger(__name__)

router = APIRouter()

class BalanceResponse(BaseModel):
    balance: str

def get_current_user(request: Request) -> Optional[dict]:
    """从请求头中获取当前用户信息"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    user_payload = verify_access_token(token)
    return user_payload

@router.get("/api/billing/getBalance", response_model=BalanceResponse)
async def get_balance(request: Request):
    """获取用户积分余额"""
    # 验证用户认证
    user_payload = get_current_user(request)
    if not user_payload:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user_payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user_id")
    
    try:
        # 从数据库获取用户信息
        user = await db_service.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 将积分转换为金额格式（积分除以100）
        points = user.get("points", 0)
        balance_amount = points / 100.0
        
        logger.info(f"User {user_id} balance request: {points} points = ${balance_amount:.2f}")
        
        return BalanceResponse(balance=f"{balance_amount:.2f}")
        
    except Exception as e:
        logger.error(f"Error getting balance for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")