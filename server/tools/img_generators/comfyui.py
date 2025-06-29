from typing import Optional, Dict, Any
import os
from io import BytesIO
import random
import json
import sys
import copy
import traceback
from utils.http_client import HttpClient
from .base import ImageGenerator, get_image_info_and_save, generate_image_id
from services.config_service import (
    config_service,
    FILES_DIR,
    IMAGE_FORMATS,
    VIDEO_FORMATS,
)
from routers.comfyui_execution import execute
from routers.video_generators import get_video_info_and_save


async def detect_file_type_comprehensive(url):
    """综合判断文件类型"""
    try:
        # 首先尝试通过HTTP头部判断
        async with HttpClient.create() as client:
            response = await client.head(url)
            content_type = response.headers.get("content-type", "").lower()

            if content_type.startswith("image/"):
                return "image"
            elif content_type.startswith("video/"):
                return "video"

        # 如果Content-Type不明确，检查URL扩展名
        if any(fmt in url.lower() for fmt in IMAGE_FORMATS):
            return "image"
        elif any(fmt in url.lower() for fmt in VIDEO_FORMATS):
            return "video"

        # 默认返回image
        return "image"

    except Exception:
        # 出错时回退到扩展名检查
        return "image" if any(fmt in url.lower() for fmt in IMAGE_FORMATS) else "video"


def get_asset_path(filename):
    """
    To get the correct path for pyinstaller bundled application
    """
    if getattr(sys, "frozen", False):
        # If the application is run as a bundle, the path is relative to the executable
        base_path = sys._MEIPASS
    else:
        # If the application is run in a normal Python environment
        base_path = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )

    return os.path.join(base_path, "asset", filename)


class ComfyUIGenerator(ImageGenerator):
    """ComfyUI image generator implementation"""

    def __init__(self):
        # Load workflows
        asset_dir = get_asset_path("flux_comfy_workflow.json")
        basic_comfy_t2i_workflow = get_asset_path("default_comfy_t2i_workflow.json")

        self.flux_comfy_workflow = None
        self.basic_comfy_t2i_workflow = None
        self.comfy_websocket_client = None

        try:
            self.flux_comfy_workflow = json.load(open(asset_dir, "r"))
            self.basic_comfy_t2i_workflow = json.load(
                open(basic_comfy_t2i_workflow, "r")
            )
        except Exception:
            traceback.print_exc()

    async def generate(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image: Optional[str] = None,
        **kwargs,
    ) -> tuple[str, int, int, str]:
        """
        Generate an image by calling offical ComfyUI Client
        """
        if not self.flux_comfy_workflow:
            raise FileNotFoundError("Flux workflow json not found")

        # Get context from kwargs
        ctx = kwargs.get("ctx", {})

        api_url = str(
            config_service.app_config.get("comfyui", {}).get("url", "")
        ).rstrip("/")

        # Process ratio
        if "flux" in model:
            # Flux generate images around 1M pixel (1024x1024)
            pixel_count = 1024**2
        else:
            # sd 1.5, basic is 512, but acceopt 768 for better quality
            pixel_count = 768**2

        w_ratio, h_ratio = map(int, aspect_ratio.split(":"))
        factor = (pixel_count / (w_ratio * h_ratio)) ** 0.5

        width = int((factor * w_ratio) / 64) * 64
        height = int((factor * h_ratio) / 64) * 64

        if "flux" in model:
            workflow = copy.deepcopy(self.flux_comfy_workflow)
            workflow["6"]["inputs"]["text"] = prompt
            workflow["30"]["inputs"]["ckpt_name"] = model
            workflow["27"]["inputs"]["width"] = width
            workflow["27"]["inputs"]["height"] = height
            workflow["31"]["inputs"]["seed"] = random.randint(1, 2**32)
        else:
            workflow = copy.deepcopy(self.basic_comfy_t2i_workflow)
            workflow["6"]["inputs"]["text"] = prompt
            workflow["4"]["inputs"]["ckpt_name"] = model
            workflow["5"]["inputs"]["width"] = width
            workflow["5"]["inputs"]["height"] = height
            workflow["3"]["inputs"]["seed"] = random.randint(1, 2**32)

        execution = await execute(workflow, api_url, ctx=ctx)
        print("🦄image execution outputs", execution.outputs)
        url = execution.outputs[0]

        # get image dimensions
        image_id = generate_image_id()
        mime_type, width, height, extension = await get_image_info_and_save(
            url, os.path.join(FILES_DIR, f"{image_id}")
        )
        filename = f"{image_id}.{extension}"
        return mime_type, width, height, filename


class ComfyUIWorkflowRunner(ImageGenerator):
    """ComfyUI image generator implementation"""

    def __init__(self, workflow_dict, base_url):
        # Load workflows
        self.workflow = workflow_dict
        self.base_url = base_url

    async def generate(
        self,
        **kwargs,
    ) -> tuple[str, int, int, str]:
        """
        Run a workflow by calling offical ComfyUI Client
        """
        # Get context from kwargs
        ctx = kwargs.get("ctx", {})

        execution = await execute(
            self.workflow, self.base_url, local_paths=True, ctx=ctx
        )
        print("🦄workflow execution outputs", execution.outputs)

        url = execution.outputs[0]

        # get image id
        image_id = generate_image_id()

        # check is video or image.
        file_type = await detect_file_type_comprehensive(url)
        get_info_func = (
            get_video_info_and_save if file_type == "video" else get_image_info_and_save
        )

        mime_type, width, height, extension = await get_info_func(
            url, os.path.join(FILES_DIR, f"{image_id}")
        )

        filename = f"{image_id}.{extension}"
        return mime_type, width, height, filename
