# services/OpenAIAgents_service/jaaz_agent.py

from typing import Dict, Any, List
import asyncio
import os
from nanoid import generate
from services.new_chat.tuzi_llm_service import TuziLLMService
from tools.utils.image_canvas_utils import save_image_to_canvas
from tools.utils.image_utils import get_image_info_and_save
from services.config_service import FILES_DIR
from common import DEFAULT_PORT

from log import get_logger

logger = get_logger(__name__)

async def create_local_response(messages: List[Dict[str, Any]], 
                                      session_id: str = "", 
                                      canvas_id: str = "",
                                      model_name: str = "gpt-4o") -> Dict[str, Any]:
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

        # 创建 LLM 服务实例
        try:
            llm_service = TuziLLMService()
        except ValueError as e:
            logger.error(f"❌ Jaaz service configuration error: {e}")
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

      
        
        result = await llm_service.generate(model_name, user_prompt, image_content)
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

        # 检查是否是文本响应（GPT-4o等文本模型）
        if result.get('type') == 'text' and result.get('text_content'):
            logger.info("✅ 返回文本对话结果")
            return {
                'role': 'assistant',
                'content': result['text_content']
            }

        # 检查是否有结果 URL（图像生成）
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
            'content': f'✨ Image Generate Success\n\nResult url: {result_url}\n\n![image_id: {filename}](http://localhost:{DEFAULT_PORT}{image_url})'
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
    asyncio.run(create_local_response([]))
