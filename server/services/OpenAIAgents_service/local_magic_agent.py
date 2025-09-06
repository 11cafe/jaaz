# services/OpenAIAgents_service/jaaz_agent.py

from typing import Dict, Any, List, Optional
import asyncio
import os
from nanoid import generate
from tools.utils.image_canvas_utils import save_image_to_canvas
from tools.utils.image_utils import get_image_info_and_save
from services.config_service import FILES_DIR
from common import DEFAULT_PORT, BASE_URL
from ..magic_draw_service import MagicDrawService
from routers.templates_router import TEMPLATES


async def create_local_magic_response(messages: List[Dict[str, Any]], 
                                      session_id: str = "", 
                                      canvas_id: str = "",
                                      system_prompt: str = "",
                                      template_id: str = "",
                                      user_info: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    本地的魔法生成功能
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
                'content': '✨ not found input image'
            }

        # 创建 Jaaz 服务实例
        try:
            magic_draw_service = MagicDrawService()
        except ValueError as e:
            print(f"❌ Tu-zi service configuration error: {e}")
            return {
                'role': 'assistant',
                'content': '✨ Cloud API Key not configured'
            }

        # 获取用户提示词
        user_prompt = ""
        if isinstance(user_message.get('content'), list):
            for content_item in user_message['content']:
                if content_item.get('type') == 'text':
                    user_prompt = content_item.get('text', '')
                    break
        elif isinstance(user_message.get('content'), str):
            user_prompt = user_message.get('content', '')

        # 调用tuzi服务生成魔法图像
        if not template_id:
            result = await magic_draw_service.generate_magic_image(system_prompt, image_content, user_info)
        else:
            # 如果有template_id，从TEMPLATES获取对应的prompt
            template_prompt = ""
            try:
                template_id_int = int(template_id)
                template = next((t for t in TEMPLATES if t["id"] == template_id_int), None)
                if template:
                    template_prompt = template.get("prompt", "")
                    print(f"✅ 找到模板prompt: {template_prompt}")
                else:
                    print(f"❌ 未找到模板ID: {template_id}")
                    template_prompt = user_prompt  # 如果没找到模板，使用用户输入
            except ValueError:
                print(f"❌ 无效的模板ID: {template_id}")
                template_prompt = user_prompt  # 如果模板ID无效，使用用户输入
            
            # 使用模板的prompt或用户的prompt，确保是字符串类型
            final_prompt = str(template_prompt if template_prompt else user_prompt)
            result = await magic_draw_service.generate_image(final_prompt, image_content, template_id, user_info)
        if not result:
            return {
                'role': 'assistant',
                'content': '✨ Magic generation failed'
            }

        # 检查是否有错误
        if result.get('error'):
            error_msg = result['error']
            print(f"❌ Magic generation error: {error_msg}")
            return {
                'role': 'assistant',
                'content': f'✨ Magic Generation Error: {error_msg}'
            }

        # 检查是否有结果 URL
        if not result.get('result_url'):
            return {
                'role': 'assistant',
                'content': '✨ Magic generation failed: No result URL'
            }

        # 初始化变量
        filename = ""
        result_url = result['result_url']
        image_url = result_url

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
            'content': f'✨ Image Generate Success\n\n![image_id: {filename}]({BASE_URL}{image_url})'
        }
        

    except (asyncio.TimeoutError, Exception) as e:
        # 检查是否是超时相关的错误
        error_msg = str(e).lower()
        if 'timeout' in error_msg or 'timed out' in error_msg:
            return {
                'role': 'assistant',
                'content': '✨ time out'
            }
        else:
            print(f"❌ 创建魔法回复时出错: {e}")
            return {
                'role': 'assistant',
                'content': f'✨ Magic Generation Error: {str(e)}'
            }

if __name__ == "__main__":
    asyncio.run(create_local_magic_response([]))
