from fastapi.responses import FileResponse
from common import DEFAULT_PORT
from tools.image_generators import generate_file_id
from services.db_service import db_service
import traceback
from services.config_service import USER_DATA_DIR, FILES_DIR
from services.websocket_service import send_to_websocket, broadcast_session_update

from PIL import Image
from io import BytesIO
import os
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
import httpx
import aiofiles
from mimetypes import guess_type
from utils.http_client import HttpClient

router = APIRouter(prefix="/api")
os.makedirs(FILES_DIR, exist_ok=True)

# 上传图片接口，支持表单提交
@router.post("/upload_image")
async def upload_image(file: UploadFile = File(...)):
    print('🦄upload_image file', file.filename)
    # 生成文件 ID 和文件名
    file_id = generate_file_id()
    filename = file.filename or ''

    # Read the file content
    content = await file.read()

    # Open the image from bytes to get its dimensions
    with Image.open(BytesIO(content)) as img:
        width, height = img.size

    # Determine the file extension
    mime_type, _ = guess_type(filename)
    # default to 'bin' if unknown
    extension = mime_type.split('/')[-1] if mime_type else ''

    # 保存图片到本地
    file_path = os.path.join(FILES_DIR, f'{file_id}.{extension}')
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    # 返回文件信息
    print('🦄upload_image file_path', file_path)
    return {
        'file_id': f'{file_id}.{extension}',
        'url': f'http://localhost:{DEFAULT_PORT}/api/file/{file_id}.{extension}',
        'width': width,
        'height': height,
    }


# 文件下载接口 (支持图片和视频)
@router.get("/file/{file_id}")
async def get_file(file_id: str):
    file_path = os.path.join(FILES_DIR, f'{file_id}')
    print('🦄get_file file_path', file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    # 获取文件的MIME类型
    mime_type, _ = guess_type(file_path)
    
    # 为视频文件设置适当的headers
    if mime_type and mime_type.startswith('video/'):
        return FileResponse(
            file_path, 
            media_type=mime_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Type": mime_type
            }
        )
    
    return FileResponse(file_path)


@router.post("/comfyui/object_info")
async def get_object_info(data: dict):
    url = data.get('url', '')
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        timeout = httpx.Timeout(10.0)
        async with HttpClient.create(timeout=timeout) as client:
            response = await client.get(f"{url}/api/object_info")
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code, detail=f"ComfyUI server returned status {response.status_code}")
    except Exception as e:
        if "ConnectError" in str(type(e)) or "timeout" in str(e).lower():
            print(f"ComfyUI connection error: {str(e)}")
            raise HTTPException(
                status_code=503, detail="ComfyUI server is not available. Please make sure ComfyUI is running.")
        print(f"Unexpected error connecting to ComfyUI: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to connect to ComfyUI: {str(e)}")
