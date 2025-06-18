from openai import OpenAI
import random
from routers.comfyui_execution import execute
import asyncio
import base64
import json
import sys
import tempfile
from services.config_service import config_service
import traceback
from services.config_service import USER_DATA_DIR, FILES_DIR
from PIL import Image
from io import BytesIO
import os
from nanoid import generate
import aiofiles
import copy
import time
from pydantic import BaseModel, Field
from common import DEFAULT_PORT
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from mimetypes import guess_type
from typing import Optional, Annotated, List
from langchain_core.tools import tool, InjectedToolCallId
from utils.http_client import HttpClient
from langchain_core.runnables import RunnableConfig

# 生成唯一文件 ID


def generate_file_id():
    return 'im_' + generate(size=8)


class GenerateImageInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for image generation. If you want to edit an image, please describe what you want to edit in the prompt.")
    aspect_ratio: str = Field(
        description="Required. Aspect ratio of the image, only these values are allowed: 1:1, 16:9, 4:3, 3:4, 9:16 Choose the best fitting aspect ratio according to the prompt. Best ratio for posters is 3:4")
    input_image: Optional[str] = Field(default=None, description="Optional; Image to use as reference. Pass image_id here, e.g. 'im_jurheut7.png'. Best for image editing cases like: Editing specific parts of the image, Removing specific objects, Maintaining visual elements across scenes (character/object consistency), Generating new content in the style of the reference (style transfer), etc.")
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_image",
      description="Generate an image using text prompt or optionally pass an image for reference or for editing",
      args_schema=GenerateImageInputSchema)
async def generate_image(
    prompt: str,
    aspect_ratio: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    input_image: Optional[str] = None,
) -> str:
    print('🛠️ tool_call_id', tool_call_id)
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print('🛠️canvas_id', canvas_id, 'session_id', session_id)
    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id
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
                mime_type, width, height, filename = await generate_image_wavespeed(prompt, model, input_image)
            elif provider == 'jaaz':
                mime_type, width, height, filename = await generate_image_jaaz_cloud(prompt, model, aspect_ratio, input_image)
            elif provider == 'openai':
                mime_type, width, height, filename = await generate_image_openai(prompt, model, image_path)
        else:
            if provider == 'replicate':
                mime_type, width, height, filename = await generate_image_replicate(prompt, model, aspect_ratio)
            elif provider == 'comfyui':
                mime_type, width, height, filename = await generate_image_comfyui(args_json, ctx)
            elif provider == 'wavespeed':
                # fix: got multiple values for argument 'prompt'
                args_json_copy = args_json.copy()
                args_json_copy.pop('prompt', None)
                mime_type, width, height, filename = await generate_image_wavespeed(prompt, model, **args_json_copy)
            elif provider == 'jaaz':
                mime_type, width, height, filename = await generate_image_jaaz_cloud(prompt, model, aspect_ratio)
            elif provider == 'openai':
                mime_type, width, height, filename = await generate_image_openai(prompt, model)

        file_id = generate_file_id()
        url = f'/api/file/{filename}'

        file_data = {
            'mimeType': mime_type,
            'id': file_id,
            'dataURL': url,
            'created': int(time.time() * 1000),
        }

        new_image_element = await generate_new_image_element(canvas_id, file_id, {
            'width': width,
            'height': height,
        })

        # update the canvas data, add the new image element
        canvas_data = await db_service.get_canvas_data(canvas_id)
        if 'data' not in canvas_data:
            canvas_data['data'] = {}
        if 'elements' not in canvas_data['data']:
            canvas_data['data']['elements'] = []
        if 'files' not in canvas_data['data']:
            canvas_data['data']['files'] = {}

        canvas_data['data']['elements'].append(new_image_element)
        canvas_data['data']['files'][file_id] = file_data

        image_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"

        print('🛠️canvas_data', canvas_data)

        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data['data']))

        await broadcast_session_update(session_id, canvas_id, {
            'type': 'image_generated',
            'element': new_image_element,
            'file': file_data,
            'image_url': image_url,
        })

        return f"image generated successfully ![image_id: {filename}]({image_url})"

    except Exception as e:
        print(f"Error generating image: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': str(e)
        })
        return f"image generation failed: {str(e)}"

print('🛠️', generate_image.args_schema.model_json_schema())


async def get_image_info_and_save(url, file_path_without_extension, is_b64=False):
    if is_b64:
        image_content = base64.b64decode(url)
    else:
        # Fetch the image asynchronously
        async with HttpClient.create() as client:
            response = await client.get(url)
            # Read the image content as bytes
            image_content = response.content
    # Open the image
    image = Image.open(BytesIO(image_content))

    # Get MIME type
    mime_type = Image.MIME.get(image.format if image.format else 'PNG')

    # Get dimensions
    width, height = image.size

    # Determine the file extension
    extension = image.format.lower() if image.format else 'png'
    file_path = f"{file_path_without_extension}.{extension}"

    # Save the image to a local file with the correct extension asynchronously
    async with aiofiles.open(file_path, 'wb') as out_file:
        await out_file.write(image_content)
    print('🦄image saved to file_path', file_path)

    return mime_type, width, height, extension


async def generate_image_replicate(prompt, model, aspect_ratio, input_image_b64: Optional[str] = None):
    try:
        api_key = config_service.app_config.get(
            'replicate', {}).get('api_key', '')
        if not api_key:
            raise ValueError(
                "Image generation failed: Replicate API key is not set")
        url = f"https://api.replicate.com/v1/models/{model}/predictions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Prefer": "wait"
        }
        data = {
            "input": {
                "prompt": prompt,
                "aspect_ratio": aspect_ratio,
            }
        }
        if input_image_b64:
            data['input']['input_image'] = input_image_b64
            model = 'black-forest-labs/flux-kontext-pro'
        async with HttpClient.create() as client:
            response = await client.post(url, headers=headers, json=data)
            res = response.json()

        output = res.get('output', '')
        image_id = 'im_' + generate(size=8)
        # image_id = int(time.time() * 1000)
        if output == '':
            if res.get('detail', '') != '':
                raise Exception(
                    f'Replicate image generation failed: {res.get("detail", "")}')
            else:
                raise Exception(
                    'Replicate image generation failed: no output url found')
        print('🦄image generation image_id', image_id)
        # get image dimensions
        mime_type, width, height, extension = await get_image_info_and_save(output, os.path.join(FILES_DIR, f'{image_id}'))
        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename
    except Exception as e:
        print('Error generating image with replicate', e)
        traceback.print_exc()
        raise e


def get_asset_path(filename):
    # To get the correct path for pyinstaller bundled application
    if getattr(sys, 'frozen', False):
        # If the application is run as a bundle, the path is relative to the executable
        base_path = sys._MEIPASS
    else:
        # If the application is run in a normal Python environment
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    return os.path.join(base_path, 'asset', filename)


asset_dir = get_asset_path('flux_comfy_workflow.json')
flux_comfy_workflow = None
basic_comfy_t2i_workflow = get_asset_path('default_comfy_t2i_workflow.json')
try:
    flux_comfy_workflow = json.load(open(asset_dir, 'r'))
    basic_comfy_t2i_workflow = json.load(open(basic_comfy_t2i_workflow, 'r'))
except Exception as e:
    traceback.print_exc()


async def generate_image_comfyui(args_json: dict, ctx: dict):
    if not flux_comfy_workflow:
        raise Exception('Flux workflow json not found')
    api_url = config_service.app_config.get('comfyui', {}).get('url', '')
    api_url = api_url.replace('http://', '').replace('https://', '')
    host = api_url.split(':')[0]
    port = api_url.split(':')[1]
    prompt = args_json.get('prompt', '')
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")
    model = image_model.get('model', '')
    if 'flux' in model:
        workflow = copy.deepcopy(flux_comfy_workflow)
        workflow['6']['inputs']['text'] = prompt
        workflow['30']['inputs']['ckpt_name'] = model
    else:
        workflow = copy.deepcopy(basic_comfy_t2i_workflow)
        workflow['6']['inputs']['text'] = prompt
        workflow['4']['inputs']['ckpt_name'] = model
    execution = await execute(workflow, host, port, ctx=ctx)
    print('🦄image execution outputs', execution.outputs)
    url = execution.outputs[0]
    # get image dimensions
    image_id = 'im_' + generate(size=8)
    mime_type, width, height, extension = await get_image_info_and_save(url, os.path.join(FILES_DIR, f'{image_id}'))
    filename = f'{image_id}.{extension}'
    return mime_type, width, height, filename


async def generate_image_wavespeed(prompt: str, model, input_image: Optional[str] = None, **kwargs):
    api_key = config_service.app_config.get('wavespeed', {}).get('api_key', '')
    url = config_service.app_config.get('wavespeed', {}).get('url', '')

    async with HttpClient.create() as client:
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'channel': os.environ.get('WAVESPEED_CHANNEL', ''),
        }
        if input_image:
            model = 'wavespeed-ai/flux-kontext-pro/multi'
            payload = {
                "prompt": prompt,
                "images": [input_image],
                "guidance_scale": kwargs.get("guidance_scale", 3.5),
                "num_images": kwargs.get("num_images", 1),
                "safety_tolerance": str(kwargs.get("safety_tolerance", "2"))
            }
        else:
            payload = {
                "enable_base64_output": False,
                "enable_safety_checker": False,
                "guidance_scale": kwargs.get("guidance_scale", 3.5),
                "num_images": kwargs.get("num_images", 1),
                "num_inference_steps": kwargs.get("num_inference_steps", 28),
                "prompt": prompt,
                "seed": -1,
                "size": kwargs.get("size", "1024*1024"),
                "strength": kwargs.get("strength", 0.8),
            }
        endpoint = f"{url.rstrip('/')}/{model}"
        response = await client.post(endpoint, json=payload, headers=headers)
        response_json = response.json()
        if response.status_code != 200 or response_json.get("code") != 200:
            raise Exception(f"WaveSpeed API error: {response_json}")
        result_url = response_json["data"]["urls"]["get"]
        # 轮询获取图片结果
        for _ in range(60):  # 最多等60秒
            await asyncio.sleep(1)
            result_resp = await client.get(result_url, headers=headers)
            result_data = result_resp.json()
            print("WaveSpeed polling result:", result_data)
            data = result_data.get("data", {})
            outputs = data.get("outputs", [])
            status = data.get("status")
            if status in ("succeeded", "completed") and outputs:
                image_url = outputs[0]
                image_id = 'im_' + generate(size=8)
                mime_type, width, height, extension = await get_image_info_and_save(image_url, os.path.join(FILES_DIR, f'{image_id}'))
                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename

            if status == "failed":
                raise Exception(
                    f"WaveSpeed generation failed: {result_data}")
        raise Exception("WaveSpeed image generation timeout")


async def generate_image_jaaz_cloud(prompt: str, model: str, aspect_ratio: str = "1:1", input_image_b64: Optional[str] = None):
    """
    使用 Jaaz API 服务生成图像
    与 Replicate 兼容但使用不同的 API 端点
    """
    try:
        # 如果模型以 openai/ 开头，调用 OpenAI 专用方法
        if model.startswith("openai/"):
            # 将 input_image_b64 转换为临时文件路径（如果存在）
            input_path = None
            if input_image_b64:
                # 从 base64 字符串中提取实际的 base64 数据
                if input_image_b64.startswith('data:'):
                    # 格式: data:image/png;base64,{base64_data}
                    header, base64_data = input_image_b64.split(',', 1)
                else:
                    base64_data = input_image_b64

                # 创建临时文件
                temp_fd, input_path = tempfile.mkstemp(suffix='.png')
                try:
                    with os.fdopen(temp_fd, 'wb') as tmp_file:
                        tmp_file.write(base64.b64decode(base64_data))
                except:
                    os.close(temp_fd)
                    raise

            try:
                # 调用 OpenAI 专用方法
                return await generate_image_jaaz_openai(prompt, model, input_path)
            finally:
                # 清理临时文件
                if input_path and os.path.exists(input_path):
                    os.unlink(input_path)

        # 非 OpenAI 模型使用原有逻辑
        # 从配置中获取 API 设置
        jaaz_config = config_service.app_config.get('jaaz', {})
        api_url = jaaz_config.get('url', '')
        api_token = jaaz_config.get('api_key', '')

        if not api_url or not api_token:
            raise ValueError("Jaaz API URL or token is not configured")

        # 构建请求 URL
        if api_url.rstrip('/').endswith('/api/v1'):
            url = f"{api_url.rstrip('/')}/image/generations"
        else:
            url = f"{api_url.rstrip('/')}/api/v1/image/generations"

        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

        # 构建请求数据，与 Replicate 格式一致
        data = {
            "prompt": prompt,
            "model": model,
            "aspect_ratio": aspect_ratio,
        }

        # 如果有输入图像，添加到请求中
        if input_image_b64:
            data['input_image'] = input_image_b64

        async with HttpClient.create() as client:
            response = await client.post(url, headers=headers, json=data)
            res = response.json()

        # 从响应中获取图像 URL
        output = res.get('output', '')
        if isinstance(output, list) and len(output) > 0:
            output = output[0]  # 取第一张图片

        if not output:
            error_detail = res.get('detail', res.get('error', 'Unknown error'))
            raise Exception(
                f'Jaaz image generation failed: {error_detail}')

        # 生成唯一图像 ID
        image_id = 'im_' + generate(size=8)

        # 下载并保存图像
        mime_type, width, height, extension = await get_image_info_and_save(
            output,
            os.path.join(FILES_DIR, f'{image_id}')
        )

        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename

    except Exception as e:
        print('Error generating image with Jaaz:', e)
        traceback.print_exc()
        raise e

# 生成新的 image 元素，放置到 canvas 中


async def generate_new_image_element(canvas_id: str, fileid: str, image_data: dict):
    canvas = await db_service.get_canvas_data(canvas_id)
    canvas_data = canvas.get('data', {})
    elements = canvas_data.get('elements', [])

    # find the last image element
    last_x = 0
    last_y = 0
    last_width = 0
    last_height = 0
    image_elements = [
        element for element in elements if element.get('type') == 'image']
    last_image_element = image_elements[-1] if len(
        image_elements) > 0 else None
    if last_image_element is not None:
        last_x = last_image_element.get('x', 0)
        last_y = last_image_element.get('y', 0)
        last_width = last_image_element.get('width', 0)
        last_height = last_image_element.get('height', 0)

    new_x = last_x + last_width + 20

    return {
        'type': 'image',
        'id': fileid,
        'x': new_x,
        'y': last_y,
        'width': image_data.get('width', 0),
        'height': image_data.get('height', 0),
        'angle': 0,
        'fileId': fileid,
        'strokeColor': '#000000',
        'fillStyle': 'solid',
        'strokeStyle': 'solid',
        'boundElements': None,
        'roundness': None,
        'frameId': None,
        'backgroundColor': 'transparent',
        'strokeWidth': 1,
        'roughness': 0,
        'opacity': 100,
        'groupIds': [],
        'seed': int(random.random() * 1000000),
        'version': 1,
        'versionNonce': int(random.random() * 1000000),
        'isDeleted': False,
        'index': None,
        'updated': 0,
        'link': None,
        'locked': False,
        'status': 'saved',
        'scale': [1, 1],
        'crop': None,
    }


async def generate_image_openai(prompt: str, model: str, input_path: Optional[str] = None, **kwargs):
    try:
        api_key = config_service.app_config.get(
            'openai', {}).get('api_key', '')
        url = config_service.app_config.get('openai', {}).get('url', '')
        model = model.replace('openai/', '')

        client = OpenAI(api_key=api_key, base_url=url)

        if input_path:
            with open(input_path, 'rb') as image_file:
                result = client.images.edit(
                    model=model,
                    image=[image_file],
                    prompt=prompt,
                    n=kwargs.get("num_images", 1)
                )

        else:
            result = client.images.generate(
                model=model,
                prompt=prompt,
                n=kwargs.get("num_images", 1),
                size=kwargs.get("size", "auto"),
            )

        image_b64 = result.data[0].b64_json
        image_id = 'im_' + generate(size=8)
        mime_type, width, height, extension = await get_image_info_and_save(image_b64, os.path.join(FILES_DIR, f'{image_id}'), is_b64=True)
        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename

    except Exception as e:
        print('Error generating image with OpenAI:', e)
        traceback.print_exc()
        raise e


async def generate_image_jaaz_openai(prompt: str, model: str, input_path: Optional[str] = None, **kwargs):
    """
    使用 Jaaz API 服务调用 OpenAI 模型生成图像
    兼容 OpenAI 图像生成 API
    """
    try:
        # 从配置中获取 Jaaz API 设置
        jaaz_config = config_service.app_config.get('jaaz', {})
        api_url = jaaz_config.get('url', '')
        api_token = jaaz_config.get('api_key', '')

        if not api_url or not api_token:
            raise ValueError("Jaaz API URL or token is not configured")

        # 构建请求 URL - 检查是否已经包含 /api/v1
        if api_url.rstrip('/').endswith('/api/v1'):
            url = f"{api_url.rstrip('/')}/image/generations"
        else:
            url = f"{api_url.rstrip('/')}/api/v1/image/generations"

        headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

        # 构建请求数据
        data = {
            "model": model,
            "prompt": prompt,
            "n": kwargs.get("num_images", 1),
            "size": kwargs.get("size", "1024x1024"),
        }

        # 如果有输入图像路径（编辑模式）
        if input_path:
            # 将图像转换为 base64
            with open(input_path, 'rb') as image_file:
                image_data = image_file.read()
                image_b64 = base64.b64encode(image_data).decode('utf-8')
                data['image'] = image_b64
                data['mask'] = None  # 如果需要遮罩，可以在这里添加

        async with HttpClient.create() as client:
            response = await client.post(url, headers=headers, json=data)
            res = response.json()

        # 检查响应格式
        if 'data' in res and len(res['data']) > 0:
            # OpenAI 格式响应
            image_data = res['data'][0]
            if 'b64_json' in image_data:
                image_b64 = image_data['b64_json']
                image_id = 'im_' + generate(size=8)
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_b64,
                    os.path.join(FILES_DIR, f'{image_id}'),
                    is_b64=True
                )
                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename
            elif 'url' in image_data:
                # URL 格式响应
                image_url = image_data['url']
                image_id = 'im_' + generate(size=8)
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url,
                    os.path.join(FILES_DIR, f'{image_id}')
                )
                filename = f'{image_id}.{extension}'
                return mime_type, width, height, filename

        # 如果没有找到有效的图像数据
        error_detail = res.get('error', res.get('detail', 'Unknown error'))
        raise Exception(f'Jaaz OpenAI image generation failed: {error_detail}')

    except Exception as e:
        print('Error generating image with Jaaz OpenAI:', e)
        traceback.print_exc()
        raise e
