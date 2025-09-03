from fastapi import APIRouter, Request, Depends
#from routers.agent import chat
from services.chat_service import handle_chat
from services.db_service import db_service
from utils.auth_utils import get_current_user_optional, get_user_uuid_for_database_operations, CurrentUser
from typing import Optional
import asyncio
import json
from log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/canvas")

@router.get("/list")
async def list_canvases(request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    logger.info("🎯 === CANVAS LIST API CALLED ===")
    logger.info(f"🔍 Request cookies: {dict(request.cookies)}")
    logger.info(f"🔍 Current user object: {current_user}")
    
    if current_user:
        logger.info(f"🔍 Current user details:")
        logger.info(f"  - ID: {current_user.id}")
        logger.info(f"  - UUID: {current_user.uuid}")
        logger.info(f"  - Email: {current_user.email}")
        logger.info(f"  - Nickname: {current_user.nickname}")
        logger.info(f"  - Points: {current_user.points}")
    else:
        logger.info("🔍 Current user: None (anonymous)")
    
    # 🔍 获取用户UUID用于数据库操作
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    logger.info(f"User UUID: {user_uuid}, Email: {user_email}")
    
    # 📋 返回用户的canvas列表
    return await db_service.list_canvases(user_uuid=user_uuid, user_email=user_email)

@router.post("/create")
async def create_canvas(request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    data = await request.json()
    id = data.get('canvas_id')
    name = data.get('name')
    template_id = data.get('template_id')
    
    # 🔍 获取用户UUID和邮箱
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    # 只有在没有template_id或template_id为空时才执行handle_chat
    if not template_id:
        asyncio.create_task(handle_chat(data))
    
    # 📝 创建canvas，关联用户UUID和邮箱
    await db_service.create_canvas(id, name, user_uuid=user_uuid, user_email=user_email)
    return {"id": id }

@router.get("/{id}")
async def get_canvas(id: str, request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    # 🔍 获取用户UUID和邮箱
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    # 📖 获取用户的canvas数据
    return await db_service.get_canvas_data(id, user_uuid=user_uuid, user_email=user_email)

@router.post("/{id}/save")
async def save_canvas(id: str, request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    payload = await request.json()
    data_str = json.dumps(payload['data'])
    
    # 🔍 获取用户UUID和邮箱
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    # 💾 保存用户的canvas数据
    await db_service.save_canvas_data(id, data_str, user_uuid=user_uuid, thumbnail=payload['thumbnail'], user_email=user_email)
    return {"id": id }

@router.post("/{id}/rename")
async def rename_canvas(id: str, request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    data = await request.json()
    name = data.get('name')
    
    # 🔍 获取用户UUID和邮箱
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    # ✏️ 重命名用户的canvas
    await db_service.rename_canvas(id, name, user_uuid=user_uuid, user_email=user_email)
    return {"id": id }

@router.delete("/{id}/delete")
async def delete_canvas(id: str, request: Request, current_user: Optional[CurrentUser] = Depends(get_current_user_optional)):
    # 🔍 获取用户UUID和邮箱
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    # 🗑️ 删除用户的canvas
    await db_service.delete_canvas(id, user_uuid=user_uuid, user_email=user_email)
    return {"id": id }