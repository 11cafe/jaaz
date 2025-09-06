# BASE_URL 配置说明

## 问题
线上部署时，图片URL显示为 `http://localhost:8000`，导致图片无法正常显示。

## 解决方案
设置环境变量 `BASE_URL` 为线上域名。

## 设置方法

### 1. 开发环境（默认）
```bash
# 不设置任何环境变量，默认使用 localhost
# BASE_URL=http://localhost:8000
```

### 2. 生产环境
```bash
# 设置为线上域名
export BASE_URL=https://www.magicart.cc

# 或者在 .env 文件中设置
echo "BASE_URL=https://www.magicart.cc" >> .env
```

### 3. Docker 部署
```yaml
environment:
  - BASE_URL=https://www.magicart.cc
```

## 修改的文件
- `common.py` - 添加 BASE_URL 配置
- `services/new_chat/logic_agent.py` - 图片URL生成
- `routers/image_router.py` - 图片上传返回URL
- `services/OpenAIAgents_service/jaaz_magic_agent.py` - Magic图片URL
- `services/OpenAIAgents_service/local_magic_agent.py` - 本地图片URL
- `tools/utils/image_generation_core.py` - 图片生成核心
- `tools/video_generation/video_canvas_utils.py` - 视频URL
- `tools/generate_image_by_midjourney_jaaz.py` - Midjourney图片URL
- `tools/comfy_dynamic.py` - ComfyUI图片URL

## 验证
设置环境变量后重启服务，生成的图片URL应该变为：
```
https://www.magicart.cc/api/file/xxx.png
```
而不是：
```
http://localhost:8000/api/file/xxx.png
```