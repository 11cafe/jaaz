from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import math

router = APIRouter(prefix="/api/templates")

# 模拟模板数据
TEMPLATES = [
    {
        "id": 1,
        "title": "拟真手办",
        "description": "生成精美的手办模型图片，适合收藏和展示",
        "image": "/static/template_images/nizhen.png",
        "tags": ["nano-banana", "手办", "收藏"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "prompt":"turn this photo into a character figure. Behind it, place a box with the character’s image printed on it, and a computer showing the Blender modeling process on its screen. In front of the box, add a round plastic base with the character figure standing on it. set the scene indoors if possible"
    }
]

@router.get("")
async def get_templates(
    search: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    limit: int = Query(12, ge=1, le=50, description="每页数量"),
    category: Optional[str] = Query(None, description="分类筛选"),
    sort_by: str = Query("downloads", description="排序字段: downloads, rating, created_at"),
    sort_order: str = Query("desc", description="排序方向: asc, desc")
):
    """获取模板列表"""
    
    print(f"test get_templates")
    # 筛选数据
    filtered_templates = TEMPLATES.copy()
    
    # 搜索过滤
    if search:
        search_lower = search.lower()
        filtered_templates = [
            template for template in filtered_templates
            if search_lower in str(template["title"]).lower() 
            or search_lower in str(template["description"]).lower()
            or any(search_lower in str(tag).lower() for tag in template["tags"])
        ]
    
    # 分类过滤
    if category and category != "all":
        filtered_templates = [
            template for template in filtered_templates
            if template["category"] == category
        ]
    
    # 排序
    reverse_order = sort_order == "desc"
    if sort_by == "downloads":
        filtered_templates.sort(key=lambda x: x["downloads"], reverse=reverse_order)
    elif sort_by == "rating":
        filtered_templates.sort(key=lambda x: x["rating"], reverse=reverse_order)
    elif sort_by == "created_at":
        filtered_templates.sort(key=lambda x: x["created_at"], reverse=reverse_order)
    
    # 分页
    total = len(filtered_templates)
    start_index = (page - 1) * limit
    end_index = start_index + limit
    templates_page = filtered_templates[start_index:end_index]
    
    return {
        "templates": templates_page,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if limit > 0 else 0
    }

@router.get("/{template_id}")
async def get_template(template_id: int):
    """获取单个模板详情"""
    template = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template

@router.post("/{template_id}/download")
async def download_template(template_id: int):
    """下载/使用模板"""
    template = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    
    # 这里可以实现实际的下载逻辑
    # 比如增加下载计数、记录用户使用等
    
    return {
        "success": True,
        "message": f"模板 '{template['title']}' 使用成功",
        "template_id": template_id
    }