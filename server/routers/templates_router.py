from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import math

router = APIRouter(prefix="/api/templates")

# 模拟模板数据
TEMPLATES = [
    {
        "id": 1,
        "title": "拟真手办",
        "description": "精美的手办模型图片，适合收藏和展示",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/nizhen.png",
        "tags": ["nano-banana", "手办", "收藏"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z",
        "use_mask": 0,
        "prompt":"turn this photo into a character figure. Behind it, place a box with the character’s image printed on it, and a computer showing the Blender modeling process on its screen. In front of the box, add a round plastic base with the character figure standing on it. set the scene indoors if possible"
    },
    {
        "id": 2,
        "title": "可爱温馨针织玩偶",
        "description": "可爱温馨针织玩偶，营造温馨可爱的氛围",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/maorong.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0,
        "prompt":"""
一张特写、构图专业的照片，展示一个手工钩织的毛线玩偶被双手轻柔地托着。玩偶造型圆润，[用户上传的第一个图片]人物得可爱Q版形象，色彩对比鲜明，细节丰富。持玩偶的双手自然、温柔，手指姿态清晰可见，皮肤质感与光影过渡自然，展现出温暖且真实的触感。背景轻微虚化，表现为室内环境，有温暖的木质桌面和从窗户洒入的自然光，营造出舒适、亲密的氛围。整体画面传达出精湛的工艺感与被珍视的温馨情绪。
"""
    },
    {
        "id": 3,
        "title": "Q版求婚场景",
        "description": "Q版求婚场景，营造温馨可爱的氛围",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/qiuhun.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0,
        "prompt":"""
将照片里的两个人转换成Q版 3D人物，场景换成求婚，背景换成淡雅五彩花瓣做的拱门，背景换成浪漫颜色，地上散落着玫瑰花瓣。除了人物采用Q版 3D人物风格，其他环境采用真实写实风格。
"""
    },
    {
        "id": 4,
        "title": "3D Q版中式婚礼图",
        "description": "Q版中式婚礼场景，传统与现代结合的浪漫氛围",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/hunli.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0,
        "prompt":"""
将照片里的两个人[用户上传的第一个图片]转换成Q版 3D人物，中式古装婚礼，大红颜色，背景“囍”字剪纸风格图案。 服饰要求：写实，男士身着长袍马褂，主体为红色，上面以金色绣龙纹图案，彰显尊贵大气 ，胸前系着大红花，寓意喜庆吉祥。女士所穿是秀禾服，同样以红色为基调，饰有精美的金色花纹与凤凰刺绣，展现出典雅华丽之感 ，头上搭配花朵发饰，增添柔美温婉气质。二者皆为中式婚礼中经典着装，蕴含着对新人婚姻美满的祝福。 头饰要求： 男士：中式状元帽，主体红色，饰有金色纹样，帽顶有精致金饰，尽显传统儒雅庄重。 女士：凤冠造型，以红色花朵为中心，搭配金色立体装饰与垂坠流苏，华丽富贵，古典韵味十足。
"""
    },
    {
        "id": 5,
        "title": "吉卜力风格",
        "description": "吉卜力风格动画场景，温暖治愈的手绘风格",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/jibuli.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0,
        "prompt":"""
以吉卜力风格重绘图片[用户输入的第一张图]
"""
    },
    {
        "id": 6,
        "title": "Q版木雕人偶",
        "description": "Q版木雕人偶风格，精致可爱的木质纹理效果",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/mudiao.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0,
        "prompt":"""
Hyper-realistic carved wooden figurine of [用户图片中的角色], chibi proportions (big head, short body), standing on a plain wood block. Keep key face traits and iconic [OUTFIT/PROP]. Visible wood grain and chisel marks, matte finish. Warm studio light, soft shadow, seamless beige background. Centered full-body, slight 3/4 angle, shallow depth of field (85mm look). Ultra-detailed, photoreal, warm sepia grading. Aspect ratio [3:4].
"""
    },
    {
        "id": 7,
        "title": "写真组图",
        "description": "高分辨率黑白肖像艺术作品，胶片质感与诗意光影的完美结合",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/xiezhen.png",
        "tags": ["nano-banana","写真组图"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0,
        "prompt":"""
将上传的照片转换成高分辨率的黑白肖像艺术作品,采用适当的不同的人物姿势，采用编辑辑类和艺术指影风格 背景呈现柔和渐变效果,从中灰过滤到近乎纯白,营造出层次感与寂静氛围。细腻的胶片颗粒质感为画面塌添了一种可触摸的、模拟捐影般的柔和质地让人联想到经典的黑白摄影。画面中的人物,枫糊却惊艳的面容从阴影中隐约浮现,并非我的摆拍,而像是被捕捉于思索或呼吸之间的瞬间。他的脸部因为光线的轮廓,呼起神秘、亲密与优雅之感。他的五官精致而深刻,敢发出忧郁与诗意之美,却不显矫饰。 一束温柔的定向光,柔和地漫射开来,轻抚他的面频曲线,又我在眼中闪现光点--这是画面的情感核心。其余部分以大量负空间占据,刻意保持简洁,使画面白由呼吸。画面中没有文字、没有标志--只有光影与情绪交织。整体氛围拍象却深具人性,仿佛一瞥即逝的目光,或半梦半醒间的记忆:亲密、永恒、令人怅然的美。.
"""
    },
    {
        "id": 8,
        "title": "电商模特换装",
        "description": "给模特换上提供的素材衣服",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/yifu_1.png",
        "tags": ["nano-banana","电商换装"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 1, # 是否需要蒙版功能
        "is_image": 0, # 蒙板时需要参考来设置 
        "prompt":"""
用户上传的是image模特, 需要为模特替换mask服装. 模特的姿势和表情保持不变，只更换服装。
"""
    },
    {
        "id": 9,
        "title": "线稿图转实物",
        "description": "将手绘线稿图快速转换为实物效果",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/xiangao.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0, # 是否需要蒙版功能
        "prompt":"""
将这张设计线稿转换为实物图。
"""
    },
    {
        "id": 10,
        "title": "专利图效果实物",
        "description": "专利线稿示意图转换为实物效果",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/zhuanli.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0, # 是否需要蒙版功能
        "prompt":"生成实物"
    },
    {
        "id": 11,
        "title": "游戏素材效果",
        "description": "将建筑主题转换为游戏图片素材效果",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/youxisucai.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0, # 是否需要蒙版功能
        "prompt":"Make Image Daytime and Isometric (Building Only)"
    },
    {
        "id": 12,
        "title": "卡通插图药丸形象",
        "description": "将角色转换为卡通药丸形象，保持原有特征的同时简化为胶囊造型",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/yaowan.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0, # 是否需要蒙版功能
        "prompt":"Create a stylized cartoon illustration of [用户图片中的角色] with a smooth, vertical pill-shaped body (rounded on top and bottom, symmetrical left to right). The body should be a single, unified capsule shape with no limbs. Do not alter the character's core design or personality, but simplify them into this playful capsule form. Use bold black outlines, flat vector-style coloring, and simple geometric features. Give the character large, expressive eyes and a fun, exaggerated facial expression that reflects their original personality. If the character wears clothes, include a minimal, iconic version of their outfit. If they do not, keep the body clean and unclothed. Use a solid bright yellow background. Center the character in a square frame. Use only flat colors. No gradients. No shadows. No texture. No smudging. The final result should be clean, modern, vector-friendly, and clearly pill-shaped."
    },
    {
        "id": 13,
        "title": "肖像照",
        "description": "专业工作室肖像照拍摄，采用黑色背景和侧光布光，营造专业摄影效果",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/gongzuoshi.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0, # 是否需要蒙版功能
        "prompt":"给图里的人生成工作室拍摄肖像照片,黑色背景,黑色T恤,采用侧光和半身像的构图"
    },
    {
        "id": 14,
        "title": "一键九宫格大头帖",
        "description": "一键生成九宫格大头帖，多种姿势表情组合",
        "image": "https://magicart-template-1301698982.cos.ap-hongkong.myqcloud.com/9gonge.png",
        "tags": ["nano-banana"],
        "downloads": 1200,
        "rating": 4.8,
        "category": "nano-banana",
        "created_at": "2025-09-07T10:30:00Z",
        "updated_at": "2025-09-07T10:30:00Z",
        "use_mask": 0, # 是否需要蒙版功能
        "prompt":"用这张照片，做一个3*3的photo booth grid，每张要用不同的姿势和表情不许重复"
    },
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