from langchain_core.runnables import RunnableConfig
import base64
from fastapi.responses import FileResponse
from common import DEFAULT_PORT
from routers.image_generators import generate_image_comfyui, generate_image_replicate, generate_image_wavespeed
from services.config_service import app_config
import traceback
from services.config_service import USER_DATA_DIR, FILES_DIR
from routers.websocket import send_to_websocket
from PIL import Image
from io import BytesIO
import os
from nanoid import generate
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
import httpx
import aiofiles
from mimetypes import guess_type
import aiohttp
import asyncio
from typing import Optional, Annotated, List
from langchain_core.tools import tool
from utils.ssl_config import create_aiohttp_session
router = APIRouter(prefix="/api")

os.makedirs(FILES_DIR, exist_ok=True)


def generate_file_id():
    return 'im_' + generate(size=8)


@router.post("/upload_image")
async def upload_image(session_id: str = Form(...), file: UploadFile = File(...)):
    print('🦄upload_image session_id', session_id)
    print('🦄upload_image file', file.filename)
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

    file_path = os.path.join(FILES_DIR, f'{file_id}.{extension}')
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)

    print('🦄upload_image file_path', file_path)
    return {
        'file_id': f'{file_id}.{extension}',
        'width': width,
        'height': height,
    }


@router.get("/file/{file_id}")
async def get_file(file_id: str):
    file_path = os.path.join(FILES_DIR, f'{file_id}')
    print('🦄get_file file_path', file_path)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@router.post("/comfyui/object_info")
async def get_object_info(data: dict):
    url = data.get('url', '')
    if not url:
        raise HTTPException(status_code=400, detail="URL is required")

    try:
        timeout = aiohttp.ClientTimeout(total=10)  # 10 second timeout
        async with create_aiohttp_session(url=url, timeout=timeout) as session:
            async with session.get(f"{url}/api/object_info") as response:
                if response.status == 200:
                    return await response.json()
                else:
                    raise HTTPException(
                        status_code=response.status, detail=f"ComfyUI server returned status {response.status}")
    except aiohttp.ClientConnectorError as e:
        print(f"ComfyUI connection error: {str(e)}")
        raise HTTPException(
            status_code=503, detail="ComfyUI server is not available. Please make sure ComfyUI is running.")
    except asyncio.TimeoutError:
        print("ComfyUI connection timeout")
        raise HTTPException(
            status_code=504, detail="ComfyUI server connection timeout")
    except Exception as e:
        print(f"Unexpected error connecting to ComfyUI: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to connect to ComfyUI: {str(e)}")


@tool("generate_image", parse_docstring=True)
async def generate_image_tool(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    input_image: Optional[str] = None,
) -> str:
    """Generate an image using text prompt or optionally pass an image for reference or for editing

    Args:
        prompt: Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt.
        aspect_ratio: Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16 Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4
        input_image: Optional; Image to use as reference. Pass image_id here, e.g. 'im_jurheut7.png'. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc.
    """
    print('🛠️', prompt, aspect_ratio)
    ctx = config.get('configurable', {})
    session_id = ctx.get('session_id', '')
    print('🛠️session_id', session_id)
    args_json = {
        'prompt': prompt,
        'aspect_ratio': aspect_ratio,
    }
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    provider = image_model.get('provider', 'replicate')

    try:
        if input_image:
            image_path = os.path.join(FILES_DIR, f'{input_image}')
            async with aiofiles.open(image_path, 'rb') as f:
                image_data = await f.read()
            b64 = base64.b64encode(image_data).decode('utf-8')

            mime_type, _ = guess_type(image_path)
            if not mime_type:
                mime_type = "image/png"  # default fallback
            input_image = f"data:{mime_type};base64,{b64}"
            if provider == 'replicate':
                mime_type, width, height, filename = await generate_image_replicate(prompt, model, aspect_ratio, input_image)
            elif provider == 'comfyui':
                mime_type, width, height, filename = await generate_image_comfyui(args_json, ctx)
            elif provider == 'wavespeed':
                mime_type, width, height, filename = await generate_image_wavespeed(prompt, input_image)
        else:
            if provider == 'replicate':
                mime_type, width, height, filename = await generate_image_replicate(prompt, model, aspect_ratio)
            elif provider == 'comfyui':
                mime_type, width, height, filename = await generate_image_comfyui(args_json, ctx)
            elif provider == 'wavespeed':
                mime_type, width, height, filename = await generate_image_wavespeed(prompt, model, input_image)

        await send_to_websocket(session_id, {
            'type': 'image_generated',
            'image_data': {
                'mime_type': mime_type,
                'url': f'/api/file/{filename}',
                'width': width,
                'height': height,
            }
        })
        return f"image generated successfully ![image_id: {filename}](http://localhost:{DEFAULT_PORT}/api/file/{filename})"

    except Exception as e:
        print(f"Error generating image: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
        raise HTTPException(status_code=500, detail=str(e))

print('🛠️', generate_image_tool.args_schema.model_json_schema())


async def generate_image(args_json: dict, ctx: dict):
    session_id = ctx.get('session_id', '')
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    provider = image_model.get('provider', 'replicate')
    prompt: str = args_json.get('prompt', '')
    aspect_ratio: str = args_json.get('aspect_ratio', '1:1')
    input_image: str = args_json.get('input_image', '')

    if prompt == '':
        raise ValueError("Image generation failed: text prompt is required")
    if model == '':
        raise ValueError("Image generation failed: model is not selected")
