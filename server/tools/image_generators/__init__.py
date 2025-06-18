import random
import base64
import json
import time
import os
from typing import Optional, Annotated
from pydantic import BaseModel, Field
import aiofiles

from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig

from common import DEFAULT_PORT
from services.config_service import FILES_DIR, config_service
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from mimetypes import guess_type

from .base import ImageProvider, ImageGenerationError, generate_file_id, save_image_from_url
from .factory import ImageProviderFactory
from .providers.replicate import ReplicateProvider
from .providers.jaaz import JaazProvider
from .providers.comfyui import ComfyUIProvider
from .providers.wavespeed import WaveSpeedProvider
from .providers.openai import OpenAIProvider


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
    """重构后的图像生成函数，使用工厂模式和抽象接口"""
    print('🛠️ tool_call_id', tool_call_id)

    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print('🛠️canvas_id', canvas_id, 'session_id', session_id)

    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    # 获取图像模型配置
    image_model = ctx.get('model_info', {}).get('image', {})
    if image_model is None:
        raise ValueError("Image model is not selected")

    model = image_model.get('model', '')
    provider = image_model.get('provider', 'replicate')

    try:
        # 处理输入图像
        input_image_b64 = None
        if input_image:
            image_path = os.path.join(FILES_DIR, input_image)
            async with aiofiles.open(image_path, 'rb') as f:
                image_data = await f.read()
            b64 = base64.b64encode(image_data).decode('utf-8')

            mime_type, _ = guess_type(image_path)
            if not mime_type:
                mime_type = "image/png"
            input_image_b64 = f"data:{mime_type};base64,{b64}"

        # 生成图像
        if provider == 'comfyui':
            # ComfyUI需要特殊处理，传递额外的参数
            mime_type, width, height, filename = await generate_image_comfyui_wrapper(
                prompt, model, aspect_ratio, ctx
            )
        else:
            # 使用工厂模式创建对应的provider
            image_provider = ImageProviderFactory.create_provider(provider)
            mime_type, width, height, filename = await image_provider.generate_image(
                prompt=prompt,
                model=model,
                aspect_ratio=aspect_ratio,
                input_image_b64=input_image_b64
            )

        # 创建文件数据
        file_id = generate_file_id()
        url = f'/api/file/{filename}'

        file_data = {
            'mimeType': mime_type,
            'id': file_id,
            'dataURL': url,
            'created': int(time.time() * 1000),
        }

        # 生成新的图像元素
        new_image_element = await generate_new_image_element(canvas_id, file_id, {
            'width': width,
            'height': height,
        })

        # 更新canvas数据
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

    except ImageGenerationError as e:
        error_msg = f"Image generation failed: {str(e)}"
        print(error_msg)
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': error_msg
        })
        return error_msg

    except Exception as e:
        error_msg = f"Unexpected error during image generation: {str(e)}"
        print(error_msg)
        await send_to_websocket(session_id, {
            'type': 'error',
            'error': error_msg
        })
        return error_msg


async def generate_new_image_element(canvas_id: str, fileid: str, image_data: dict):
    """生成新的image元素，放置到canvas中"""
    canvas = await db_service.get_canvas_data(canvas_id)
    canvas_data = canvas.get('data', {})
    elements = canvas_data.get('elements', [])

    # 找到最后一个图像元素
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


async def generate_image_comfyui_wrapper(prompt: str, model: str, aspect_ratio: str, ctx: dict):
    """ComfyUI特殊wrapper函数，因为它需要ctx参数"""
    from .providers.comfyui import ComfyUIProvider

    comfyui_config = config_service.app_config.get('comfyui', {})
    comfyui_provider = ComfyUIProvider(comfyui_config)

    # 使用特殊的generate_image_with_ctx方法
    return await comfyui_provider.generate_image_with_ctx(
        prompt=prompt,
        model=model,
        aspect_ratio=aspect_ratio,
        ctx=ctx
    )


__all__ = [
    'generate_image',
    'generate_new_image_element',
    'ImageProvider',
    'ImageGenerationError',
    'ImageProviderFactory',
    'ReplicateProvider',
    'JaazProvider',
    'ComfyUIProvider',
    'WaveSpeedProvider',
    'OpenAIProvider',
    'generate_file_id',
    'save_image_from_url'
]

print('🛠️', generate_image.args_schema.model_json_schema())
