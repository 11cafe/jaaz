"""
Canvas跨域修复路由
提供API来修复现有Canvas中的腾讯云URL，转换为本地代理URL
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from services.db_service import db_service
from utils.url_converter import get_canvas_image_url
import json
from typing import Dict, Any, List
from log import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/canvas")

@router.post("/fix-cors/{canvas_id}")
async def fix_canvas_cors(canvas_id: str):
    """
    修复指定Canvas中的跨域问题
    将所有腾讯云图片URL转换为本地代理URL
    """
    try:
        logger.info(f"🔧 开始修复Canvas跨域问题: {canvas_id}")
        
        # 获取Canvas数据
        canvas = await db_service.get_canvas_data(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        
        canvas_data = canvas.get("data", {})
        if not canvas_data:
            return JSONResponse({"status": "no_data", "message": "Canvas没有数据"})
        
        files = canvas_data.get("files", {})
        if not files:
            return JSONResponse({"status": "no_files", "message": "Canvas没有图片文件"})
        
        fixed_count = 0
        total_files = len(files)
        
        # 遍历所有文件，修复腾讯云URL
        for file_id, file_data in files.items():
            if not isinstance(file_data, dict):
                continue
                
            data_url = file_data.get("dataURL", "")
            if not data_url:
                continue
            
            # 检查是否是腾讯云URL
            if "cos." in data_url and "myqcloud.com" in data_url:
                # 提取文件名
                try:
                    if "/" in data_url:
                        filename = data_url.split("/")[-1].split("?")[0]
                        
                        # 转换为本地代理URL
                        canvas_safe_url = get_canvas_image_url(filename)
                        
                        # 保存原腾讯云URL作为备用
                        file_data["cloudURL"] = data_url
                        file_data["dataURL"] = canvas_safe_url
                        
                        fixed_count += 1
                        logger.info(f"✅ 修复文件 {file_id}: {filename}")
                        logger.info(f"   原URL: {data_url[:50]}...")
                        logger.info(f"   新URL: {canvas_safe_url}")
                        
                except Exception as e:
                    logger.error(f"❌ 修复文件 {file_id} 失败: {e}")
                    continue
        
        if fixed_count > 0:
            # 保存修复后的Canvas数据
            await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data))
            logger.info(f"✅ Canvas跨域修复完成: {canvas_id}, 修复了 {fixed_count}/{total_files} 个文件")
            
            return JSONResponse({
                "status": "success",
                "message": f"修复完成，共修复 {fixed_count} 个图片文件",
                "fixed_count": fixed_count,
                "total_files": total_files
            })
        else:
            return JSONResponse({
                "status": "no_fix_needed", 
                "message": "没有需要修复的腾讯云URL",
                "fixed_count": 0,
                "total_files": total_files
            })
            
    except Exception as e:
        logger.error(f"❌ 修复Canvas跨域问题失败: {canvas_id}, error: {e}")
        raise HTTPException(status_code=500, detail=f"修复失败: {str(e)}")

@router.get("/check-cors/{canvas_id}")
async def check_canvas_cors(canvas_id: str):
    """
    检查指定Canvas是否存在跨域问题
    """
    try:
        # 获取Canvas数据
        canvas = await db_service.get_canvas_data(canvas_id)
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")
        
        canvas_data = canvas.get("data", {})
        files = canvas_data.get("files", {})
        
        total_files = len(files)
        cors_files = 0
        cors_urls = []
        
        # 检查所有文件的URL
        for file_id, file_data in files.items():
            if not isinstance(file_data, dict):
                continue
                
            data_url = file_data.get("dataURL", "")
            if "cos." in data_url and "myqcloud.com" in data_url:
                cors_files += 1
                cors_urls.append({
                    "file_id": file_id,
                    "url": data_url[:100] + "..." if len(data_url) > 100 else data_url
                })
        
        return JSONResponse({
            "canvas_id": canvas_id,
            "total_files": total_files,
            "cors_files": cors_files,
            "has_cors_issues": cors_files > 0,
            "cors_urls": cors_urls
        })
        
    except Exception as e:
        logger.error(f"❌ 检查Canvas跨域问题失败: {canvas_id}, error: {e}")
        raise HTTPException(status_code=500, detail=f"检查失败: {str(e)}")

@router.post("/fix-all-canvas")
async def fix_all_canvas_cors():
    """
    修复所有Canvas的跨域问题
    """
    try:
        logger.info("🔧 开始修复所有Canvas的跨域问题")
        
        # 这里需要获取所有Canvas ID，但db_service可能没有这个方法
        # 暂时返回提示，让用户单独修复特定Canvas
        return JSONResponse({
            "status": "not_implemented",
            "message": "批量修复功能暂未实现，请使用 /fix-cors/{canvas_id} 修复特定Canvas"
        })
        
    except Exception as e:
        logger.error(f"❌ 批量修复Canvas跨域问题失败: {e}")
        raise HTTPException(status_code=500, detail=f"批量修复失败: {str(e)}")
