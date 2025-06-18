import os
import sys
import json
import copy
import traceback
from typing import Optional, Tuple
from services.config_service import FILES_DIR
from routers.comfyui_execution import execute
from ..base import ImageProvider, ImageGenerationError, generate_file_id, save_image_from_url


def get_asset_path(filename):
    """获取资源文件路径"""
    # To get the correct path for pyinstaller bundled application
    if getattr(sys, 'frozen', False):
        # If the application is run as a bundle, the path is relative to the executable
        base_path = sys._MEIPASS
    else:
        # If the application is run in a normal Python environment
        base_path = os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))))

    return os.path.join(base_path, 'asset', filename)


class ComfyUIProvider(ImageProvider):
    """ComfyUI 图像生成器"""

    def __init__(self, config: dict):
        super().__init__(config)
        self.flux_comfy_workflow = None
        self.basic_comfy_t2i_workflow = None
        self._load_workflows()

    def _load_workflows(self):
        """加载工作流文件"""
        try:
            asset_dir = get_asset_path('flux_comfy_workflow.json')
            basic_comfy_t2i_workflow_path = get_asset_path(
                'default_comfy_t2i_workflow.json')

            self.flux_comfy_workflow = json.load(open(asset_dir, 'r'))
            self.basic_comfy_t2i_workflow = json.load(
                open(basic_comfy_t2i_workflow_path, 'r'))
        except Exception as e:
            print(f"Failed to load ComfyUI workflows: {e}")
            traceback.print_exc()

    def validate_config(self) -> bool:
        """验证ComfyUI配置"""
        api_url = self.get_api_url()
        has_workflows = self.flux_comfy_workflow is not None and self.basic_comfy_t2i_workflow is not None
        return bool(api_url and has_workflows)

    async def generate_image(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str = "1:1",
        input_image_b64: Optional[str] = None
    ) -> Tuple[str, int, int, str]:
        """生成图像使用ComfyUI API"""
        try:
            if not self.validate_config():
                raise ImageGenerationError(
                    "ComfyUI configuration is invalid or workflows not found")

            if not self.flux_comfy_workflow:
                raise ImageGenerationError('Flux workflow json not found')

            api_url = self.get_api_url()
            api_url = api_url.replace('http://', '').replace('https://', '')
            host = api_url.split(':')[0]
            port = api_url.split(':')[1]

            # 选择工作流
            if 'flux' in model:
                workflow = copy.deepcopy(self.flux_comfy_workflow)
                workflow['6']['inputs']['text'] = prompt
                workflow['30']['inputs']['ckpt_name'] = model
            else:
                workflow = copy.deepcopy(self.basic_comfy_t2i_workflow)
                workflow['6']['inputs']['text'] = prompt
                workflow['4']['inputs']['ckpt_name'] = model

            # 执行ComfyUI工作流
            # 注意：这里需要传递ctx参数，但由于接口限制，我们创建一个简单的ctx
            ctx = {'tool_call_id': 'comfyui_generation'}
            execution = await execute(workflow, host, port, ctx=ctx)

            print('🦄 ComfyUI execution outputs', execution.outputs)

            if not execution.outputs or len(execution.outputs) == 0:
                raise ImageGenerationError(
                    "ComfyUI execution failed: no outputs")

            url = execution.outputs[0]

            # 生成文件ID并保存图像
            image_id = generate_file_id()
            mime_type, width, height, extension = await save_image_from_url(
                url,
                os.path.join(FILES_DIR, image_id)
            )

            filename = f'{image_id}.{extension}'
            print(f'🦄 ComfyUI image generated: {filename}')

            return mime_type, width, height, filename

        except Exception as e:
            print(f'Error generating image with ComfyUI: {e}')
            raise ImageGenerationError(f"ComfyUI generation failed: {str(e)}")

    async def generate_image_with_ctx(
        self,
        prompt: str,
        model: str,
        aspect_ratio: str,
        ctx: dict
    ) -> Tuple[str, int, int, str]:
        """特殊的generate_image方法，接受ctx参数用于ComfyUI执行"""
        try:
            if not self.validate_config():
                raise ImageGenerationError(
                    "ComfyUI configuration is invalid or workflows not found")

            if not self.flux_comfy_workflow:
                raise ImageGenerationError('Flux workflow json not found')

            api_url = self.get_api_url()
            api_url = api_url.replace('http://', '').replace('https://', '')
            host = api_url.split(':')[0]
            port = api_url.split(':')[1]

            # 选择工作流
            if 'flux' in model:
                workflow = copy.deepcopy(self.flux_comfy_workflow)
                workflow['6']['inputs']['text'] = prompt
                workflow['30']['inputs']['ckpt_name'] = model
            else:
                workflow = copy.deepcopy(self.basic_comfy_t2i_workflow)
                workflow['6']['inputs']['text'] = prompt
                workflow['4']['inputs']['ckpt_name'] = model

            # 执行ComfyUI工作流，使用传入的ctx
            execution = await execute(workflow, host, port, ctx=ctx)

            print('🦄 ComfyUI execution outputs', execution.outputs)

            if not execution.outputs or len(execution.outputs) == 0:
                raise ImageGenerationError(
                    "ComfyUI execution failed: no outputs")

            url = execution.outputs[0]

            # 生成文件ID并保存图像
            image_id = generate_file_id()
            mime_type, width, height, extension = await save_image_from_url(
                url,
                os.path.join(FILES_DIR, image_id)
            )

            filename = f'{image_id}.{extension}'
            print(f'🦄 ComfyUI image generated: {filename}')

            return mime_type, width, height, filename

        except Exception as e:
            print(f'Error generating image with ComfyUI: {e}')
            raise ImageGenerationError(f"ComfyUI generation failed: {str(e)}")
