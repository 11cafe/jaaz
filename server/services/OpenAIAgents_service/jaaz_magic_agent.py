# services/OpenAIAgents_service/jaaz_agent.py

from typing import Dict, Any, List
import asyncio
import os
from nanoid import generate
from tools.utils.image_canvas_utils import save_image_to_canvas
from tools.utils.image_utils import get_image_info_and_save
from services.config_service import FILES_DIR
from common import DEFAULT_PORT
from ..jaaz_service import JaazService


async def create_jaaz_response(messages: List[Dict[str, Any]], session_id: str = "", canvas_id: str = "") -> Dict[str, Any]:
    """
    基于云端服务的图像生成响应函数
    实现和 magic_agent 相同的功能
    """
    try:
        # 获取图片内容
        user_message: Dict[str, Any] = messages[-1]
        image_content: str = ""

        if isinstance(user_message.get('content'), list):
            for content_item in user_message['content']:
                if content_item.get('type') == 'image_url':
                    image_content = content_item.get(
                        'image_url', {}).get('url', "")
                    break

        if not image_content:
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': '✨ not found input image'
                    }
                ]
            }

        # 创建 Jaaz 服务实例
        try:
            jaaz_service = JaazService()
        except ValueError as e:
            print(f"❌ Jaaz service configuration error: {e}")
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': '✨ Cloud API Key not configured'
                    }
                ]
            }

        # 调用 Jaaz 服务生成魔法图像
        result = await jaaz_service.generate_magic_image(image_content)
        if not result:
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': '✨ Magic generation failed'
                    }
                ]
            }

        # 检查是否有错误
        if result.get('error'):
            error_msg = result['error']
            print(f"❌ Magic generation error: {error_msg}")
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': f'✨ Magic Generation Error: {error_msg}'
                    }
                ]
            }

        # 检查是否有结果 URL
        if not result.get('result_url'):
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': '✨ Magic generation failed: No result URL'
                    }
                ]
            }

        # 初始化变量
        filename = ""
        image_url = result['result_url']

        # 保存图片到画布
        if session_id and canvas_id:
            try:
                # 生成唯一文件名
                file_id = generate(size=10)
                file_path_without_extension = os.path.join(FILES_DIR, file_id)

                # 下载并保存图片
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url, file_path_without_extension, is_b64=False
                )

                width = max(1, int(width / 2))
                height = max(1, int(height / 2))

                # 生成文件名
                filename = f'{file_id}.{extension}'

                # 保存图片到画布
                image_url = await save_image_to_canvas(session_id, canvas_id, filename, mime_type, width, height)
                print(f"✨ 图片已保存到画布: {filename}")
            except Exception as e:
                print(f"❌ 保存图片到画布失败: {e}")

        return {
            'role': 'assistant',
            'content': [
                {
                    'type': 'text',
                    'text': f'✨ Magic Success!!! ![image_id: {filename}](http://localhost:{DEFAULT_PORT}{image_url})'
                },
            ]
        }

    except (asyncio.TimeoutError, Exception) as e:
        # 检查是否是超时相关的错误
        error_msg = str(e).lower()
        if 'timeout' in error_msg or 'timed out' in error_msg:
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': '✨ time out'
                    }
                ]
            }
        else:
            print(f"❌ 创建魔法回复时出错: {e}")
            return {
                'role': 'assistant',
                'content': [
                    {
                        'type': 'text',
                        'text': f'✨ Magic Generation Error: {str(e)}'
                    }
                ]
            }

if __name__ == "__main__":
    asyncio.run(create_jaaz_response([]))
