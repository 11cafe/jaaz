from fastapi import APIRouter, Request
#from routers.agent import chat
from services.chat_service import handle_chat
from services.db_service import db_service
from utils.auth_utils import ensure_user_directory_exists, get_user_email_from_request
import asyncio
import json

router = APIRouter(prefix="/api/canvas")

@router.get("/list")
async def list_canvases(request: Request):
    # 🗂️ 确保用户目录存在（首页访问时创建）
    ensure_user_directory_exists(request)
    
    # 🔍 获取用户邮箱
    user_email = get_user_email_from_request(request)
    
    # 📋 返回用户的canvas列表
    return await db_service.list_canvases(user_email=user_email)

@router.post("/create")
async def create_canvas(request: Request):
    data = await request.json()
    id = data.get('canvas_id')
    name = data.get('name')
    template_id = data.get('template_id')
    
    # 🔍 获取用户邮箱
    user_email = get_user_email_from_request(request)
    
    # 只有在没有template_id或template_id为空时才执行handle_chat
    if not template_id:
        asyncio.create_task(handle_chat(data))
    
    # 📝 创建canvas，关联用户邮箱
    await db_service.create_canvas(id, name, user_email=user_email)
    return {"id": id }

@router.get("/{id}")
async def get_canvas(id: str, request: Request):
    # 🔍 获取用户邮箱
    user_email = get_user_email_from_request(request)
    
    # 📖 获取用户的canvas数据
    return await db_service.get_canvas_data(id, user_email=user_email)

@router.post("/{id}/save")
async def save_canvas(id: str, request: Request):
    payload = await request.json()
    data_str = json.dumps(payload['data'])
    
    # 🔍 获取用户邮箱
    user_email = get_user_email_from_request(request)
    
    # 💾 保存用户的canvas数据
    await db_service.save_canvas_data(id, data_str, payload['thumbnail'], user_email=user_email)
    return {"id": id }

@router.post("/{id}/rename")
async def rename_canvas(id: str, request: Request):
    data = await request.json()
    name = data.get('name')
    
    # 🔍 获取用户邮箱
    user_email = get_user_email_from_request(request)
    
    # ✏️ 重命名用户的canvas
    await db_service.rename_canvas(id, name, user_email=user_email)
    return {"id": id }

@router.delete("/{id}/delete")
async def delete_canvas(id: str, request: Request):
    # 🔍 获取用户邮箱
    user_email = get_user_email_from_request(request)
    
    # 🗑️ 删除用户的canvas
    await db_service.delete_canvas(id, user_email=user_email)
    return {"id": id }