from fastapi import APIRouter, Request, Depends
#from routers.agent import chat
from services.new_chat import handle_chat
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
    
    # 添加详细的调试日志
    logger.info(f"[debug] Canvas create request data: {list(data.keys())}")
    logger.info(f"[debug] Canvas ID: {id}, Name: {name}, Template ID: {template_id}")
    logger.info(f"[debug] Messages count: {len(data.get('messages', []))}")
    logger.info(f"[debug] Session ID: {data.get('session_id')}")
    logger.info(f"[debug] Text model: {data.get('text_model')}")
    
    # 🔍 获取用户UUID和邮箱
    user_uuid = get_user_uuid_for_database_operations(current_user)
    user_email = current_user.email if current_user else None
    
    # 只有在没有template_id或template_id为空时才执行handle_chat
    if not template_id:
        # 添加用户信息到请求数据中
        if current_user:
            data['user_info'] = {
                'id': current_user.id,
                'uuid': current_user.uuid,
                'email': current_user.email,
                'nickname': current_user.nickname
            }
        
        # 创建带错误处理的异步任务
        async def handle_chat_with_error_handling():
            try:
                await handle_chat(data)
            except Exception as e:
                logger.error(f"Error in canvas chat handling: {e}")
                # 发送错误到前端
                from services.websocket_service import send_to_websocket
                try:
                    await send_to_websocket(data.get('session_id', ''), {
                        'type': 'error',
                        'error': f"Chat processing failed: {str(e)}"
                    })
                except Exception as ws_error:
                    logger.error(f"Failed to send error via websocket: {ws_error}")
        
        asyncio.create_task(handle_chat_with_error_handling())
    
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
    try:
        # 💾 [CANVAS_SAVE] 开始保存画布数据
        logger.info(f"💾 [CANVAS_SAVE] 开始保存画布: {id}")
        
        payload = await request.json()
        data_str = json.dumps(payload['data'])
        
        # 🔍 获取用户UUID和邮箱
        user_uuid = get_user_uuid_for_database_operations(current_user)
        user_email = current_user.email if current_user else None
        
        logger.info(f"💾 [CANVAS_SAVE] 用户信息: UUID={user_uuid}, Email={user_email}")
        logger.info(f"💾 [CANVAS_SAVE] 数据大小: {len(data_str)} 字符")
        
        # 检查payload结构
        if 'data' not in payload:
            logger.error(f"❌ [CANVAS_SAVE] payload缺少data字段")
            return {"error": "Missing data field in payload"}, 400
            
        if 'thumbnail' not in payload:
            logger.warning(f"⚠️ [CANVAS_SAVE] payload缺少thumbnail字段，使用默认值")
            payload['thumbnail'] = None
        
        # 💾 保存用户的canvas数据
        await db_service.save_canvas_data(
            id, 
            data_str, 
            user_uuid=user_uuid, 
            thumbnail=payload['thumbnail'], 
            user_email=user_email
        )
        
        logger.info(f"✅ [CANVAS_SAVE] 画布保存成功: {id}")
        return {"id": id}
        
    except json.JSONDecodeError as e:
        logger.error(f"❌ [CANVAS_SAVE] JSON解析错误: {e}")
        return {"error": "Invalid JSON format"}, 400
        
    except Exception as e:
        logger.error(f"❌ [CANVAS_SAVE] 保存画布失败: {id}, 错误: {e}")
        logger.error(f"❌ [CANVAS_SAVE] 错误类型: {type(e).__name__}")
        import traceback
        logger.error(f"❌ [CANVAS_SAVE] 错误堆栈:\n{traceback.format_exc()}")
        return {"error": f"Failed to save canvas: {str(e)}"}, 500

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