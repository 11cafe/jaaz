# services/OpenAIAgents_service/jaaz_agent.py

from typing import Dict, Any, List, Optional
import asyncio
import os
from nanoid import generate
from services.new_chat.tuzi_llm_service import TuziLLMService
from tools.utils.image_canvas_utils import save_image_to_canvas
from tools.utils.image_utils import get_image_info_and_save
from services.config_service import get_user_files_dir
from utils.cos_image_service import get_cos_image_service
from common import DEFAULT_PORT, BASE_URL

from log import get_logger

logger = get_logger(__name__)

async def create_local_response(messages: List[Dict[str, Any]], 
                                      session_id: str = "", 
                                      canvas_id: str = "",
                                      model_name: str = "gpt-4o",
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

        # 创建 LLM 服务实例
        try:
            llm_service = TuziLLMService()
        except ValueError as e:
            logger.error(f"❌ Tu-zi service configuration error: {e}")
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

      
        
        result = await llm_service.generate(model_name, user_prompt, image_content, user_info)
        if not result:
            # 导入错误消息工具
            from utils.error_messages import ErrorMessages
            return {
                'role': 'assistant',
                'content': ErrorMessages.get_generation_failed_message()
            }

        # 处理 result 可能是字符串的情况（错误消息）
        if isinstance(result, str):
            logger.warning(f"⚠️ 收到字符串结果（可能是错误消息）: {result}")
            return {
                'role': 'assistant',
                'content': result  # 直接返回友好的错误消息
            }

        # 检查是否有错误
        if isinstance(result, dict) and result.get('error'):
            error_msg = result['error']
            logger.error(f"❌ Magic generation error: {error_msg}")
            from utils.error_messages import get_user_friendly_error
            return {
                'role': 'assistant',
                'content': get_user_friendly_error(error_msg)
            }

        # 检查是否是文本响应（GPT-4o等文本模型）
        if isinstance(result, dict) and result.get('type') == 'text' and result.get('text_content'):
            logger.info("✅ 返回文本对话结果")
            return {
                'role': 'assistant',
                'content': result['text_content']
            }

        # 检查是否有结果 URL（图像生成）
        if not result.get('result_url'):
            from utils.error_messages import ErrorMessages
            return {
                'role': 'assistant',
                'content': ErrorMessages.get_generation_failed_message()
            }

        # 初始化变量
        filename = ""
        cos_url = None
        result_url = result['result_url']
        image_url = result_url

        # 保存图片到画布
        if session_id and canvas_id:
            try:
                # 生成唯一文件名
                file_id = generate(size=10)
                
                # 获取用户文件目录
                user_email = user_info.get('email') if user_info else None
                user_id = user_info.get('uuid') if user_info else None
                user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
                file_path_without_extension = os.path.join(user_files_dir, file_id)

                # 下载并保存图片到本地临时文件
                mime_type, width, height, extension = await get_image_info_and_save(
                    image_url, file_path_without_extension, is_b64=False
                )

                width = max(1, int(width / 2))
                height = max(1, int(height / 2))

                # 生成文件名（用作腾讯云key）
                filename = f'{file_id}.{extension}'
                local_file_path = f"{file_path_without_extension}.{extension}"
                
                # 尝试上传到腾讯云
                cos_service = get_cos_image_service()
                cos_url = await cos_service.upload_image_from_file(
                    local_file_path=local_file_path,
                    image_key=filename,
                    content_type=mime_type,
                    delete_local=cos_service.available  # 只有在腾讯云可用时才删除本地文件
                )
                
                if cos_url:
                    logger.info(f"✅ 图片已上传到腾讯云: {filename} -> {cos_url}")
                else:
                    logger.info(f"📁 腾讯云不可用，图片保存在本地: {filename}")
                    cos_url = None  # 确保cos_url为None，后续逻辑会使用本地URL

                # 保存图片到画布
                image_url = await save_image_to_canvas(session_id, canvas_id, filename, mime_type, width, height)
                print(f"✨ 图片已保存到画布: {filename}")
            except Exception as e:
                print(f"❌ 保存图片到画布失败: {e}")

        # 使用腾讯云URL或者画布返回的URL
        final_image_url = cos_url if cos_url else f"{BASE_URL}{image_url}"
        
        return {
            'role': 'assistant',
            'content': f'✨ Image Generate Success\n\n![image_id: {filename}]({final_image_url})'
        }
        

    except (asyncio.TimeoutError, Exception) as e:
        # 使用友好的错误消息
        from utils.error_messages import get_user_friendly_error
        logger.error(f"❌ 创建魔法回复时出错: {e}")
        
        # 检查是否是超时相关的错误
        error_msg = str(e).lower()
        if 'timeout' in error_msg or 'timed out' in error_msg:
            from utils.error_messages import ErrorMessages
            return {
                'role': 'assistant',
                'content': ErrorMessages.get_timeout_message()
            }
        else:
            return {
                'role': 'assistant',
                'content': get_user_friendly_error(str(e))
            }

if __name__ == "__main__":
    asyncio.run(create_local_response([]))
