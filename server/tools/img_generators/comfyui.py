from typing import Optional, Dict, Any
import os
import random
import json
import sys
import copy
import traceback
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import config_service, FILES_DIR
from routers.comfyui_execution import execute


def get_asset_path(filename):
    """
    To get the correct path for pyinstaller bundled application
    """
    if getattr(sys, 'frozen', False):
        # If the application is run as a bundle, the path is relative to the executable
        base_path = sys._MEIPASS
    else:
        # If the application is run in a normal Python environment
        base_path = os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))))

    return os.path.join(base_path, 'asset', filename)


class ComfyUIGenerator(ImageGenerator):
    """ComfyUI image generator implementation"""

    def __init__(self):
        # Load workflows
        asset_dir = get_asset_path('flux_comfy_workflow.json')
        basic_comfy_t2i_workflow = get_asset_path(
            'default_comfy_t2i_workflow.json')

        self.flux_comfy_workflow = None
        self.basic_comfy_t2i_workflow = None
        self.comfy_websocket_client = None

        try:
            self.flux_comfy_workflow = json.load(open(asset_dir, 'r'))
            self.basic_comfy_t2i_workflow = json.load(
                open(basic_comfy_t2i_workflow, 'r'))
        except Exception:
            traceback.print_exc()

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs
    ) -> tuple[str, int, int, str]:
        """
        Generate an image by calling offical ComfyUI Client
        """
        if not self.flux_comfy_workflow:
            raise FileNotFoundError('Flux workflow json not found')

        # Get context from kwargs
        ctx = kwargs.get('ctx', {})

        api_url = config_service.app_config.get('comfyui', {}).get('url', '')
        protocol = 'https' if api_url.startswith('https://') else 'http'
        api_url = api_url.replace('http://', '').replace('https://', '')
        host = api_url.split(':')[0]
        port = api_url.split(':')[1] if ':' in api_url else (443 if protocol == 'https' else 80) # 添加对没有端口号的URL的处理

        # Process ratio
        if 'flux' in model:
            # Flux generate images around 1M pixel (1024x1024)
            pixel_count = 1024 ** 2
        else:
            # sd 1.5, basic is 512, but acceopt 768 for better quality
            pixel_count = 768 ** 2

        w_ratio, h_ratio = map(int, aspect_ratio.split(':'))
        factor = (pixel_count / (w_ratio * h_ratio)) ** 0.5

        width = int((factor * w_ratio) / 64) * 64
        height = int((factor * h_ratio) / 64) * 64

        if 'flux' in model:
            workflow = copy.deepcopy(self.flux_comfy_workflow)
            workflow['6']['inputs']['text'] = prompt
            workflow['30']['inputs']['ckpt_name'] = model
            workflow['27']['inputs']['width'] = width
            workflow['27']['inputs']['height'] = height
            workflow['31']['inputs']['seed'] = random.randint(1, 2 ** 32)
        else:
            workflow = copy.deepcopy(self.basic_comfy_t2i_workflow)
            workflow['6']['inputs']['text'] = prompt
            workflow['4']['inputs']['ckpt_name'] = model
            workflow['5']['inputs']['width'] = width
            workflow['5']['inputs']['height'] = height
            workflow['3']['inputs']['seed'] = random.randint(1, 2 ** 32)

        execution = await execute(workflow, host, port, ctx=ctx, protocol=protocol)
        print('🦄image execution outputs', execution.outputs)
        url = execution.outputs[0]

        # get image dimensions
        image_id = generate_image_id()
        mime_type, width, height, extension = await get_image_info_and_save(
            url, os.path.join(FILES_DIR, f'{image_id}')
        )
        filename = f'{image_id}.{extension}'
        return mime_type, width, height, filename
