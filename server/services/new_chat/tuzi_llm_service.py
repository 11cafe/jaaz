# services/OpenAIAgents_service/jaaz_service.py
import base64
import os
import uuid
import json
import asyncio
import aiohttp
from typing import Dict, Any, Optional, List
from utils.http_client import HttpClient
from services.config_service import config_service
from utils.image_analyser import ImageAnalyser
from log import get_logger
from openai import AsyncOpenAI

logger = get_logger(__name__)

class TuziLLMService:
    """基于兔子API的LLM服务
    """

    def __init__(self):
        """初始化Tuzi LLM服务"""
        config = config_service.app_config.get('openai', {})
        self.api_url = str(config.get("url", "")).rstrip("/")
        self.api_token = str(config.get("api_key", ""))

        if not self.api_url:
            raise ValueError("Tu-zi API URL is not configured")
        if not self.api_token:
            raise ValueError("Tu-zi API token is not configured")

        # API URL 已包含完整路径，无需额外添加后缀

        logger.info(f"✅ Tu-zi service initialized with API URL: {self.api_url}")

    def _is_configured(self) -> bool:
        """检查 Tu-zi API 是否已配置"""
        return bool(self.api_url and self.api_token)

    def _build_headers(self) -> Dict[str, str]:
        """构建请求头"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }

    async def create_magic_task(self, image_content: str) -> str:
        """
        创建云端魔法图像生成任务

        Args:
            image_content: 图片内容（base64 或 URL）

        Returns:
            str: 任务 ID，失败时返回空字符串
        """
        logger.info(f"👇create_magic_task image_content {image_content}")
        try:
            if not image_content or not image_content.startswith('data:image/'):
                logger.error("❌ Invalid image content format")
                return ""
            
            
            async with HttpClient.create_aiohttp() as session:
                async with session.post(
                    f"{self.api_url}/image/magic",
                    headers=self._build_headers(),
                    json={
                        "image": image_content
                    },
                    timeout=aiohttp.ClientTimeout(total=60.0)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        task_id = data.get('task_id', '')
                        if task_id:
                            logger.info(f"✅ Magic task created: {task_id}")
                            return task_id
                        else:
                            logger.error("❌ No task_id in response")
                            return ""
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Failed to create magic task: {response.status} - {error_text}")
                        return ""

        except Exception as e:
            print(f"❌ Error creating magic task: {e}")
            return ""

    async def create_video_task(
        self,
        prompt: str,
        model: str,
        resolution: Optional[str] = None,
        duration: Optional[int] = None,
        aspect_ratio: Optional[str] = None,
        input_images: Optional[List[str]] = None,
        **kwargs: Any
    ) -> str:
        """
        创建云端视频生成任务

        Args:
            prompt: 视频生成提示词
            model: 视频生成模型
            resolution: 视频分辨率
            duration: 视频时长（秒）
            aspect_ratio: 宽高比
            input_images: 输入图片列表（可选）
            **kwargs: 其他参数

        Returns:
            str: 任务 ID

        Raises:
            Exception: 当任务创建失败时抛出异常
        """
        logger.info(f"👇create_video_task prompt: {prompt}, model: {model}, resolution: {resolution}, duration: {duration}, aspect_ratio: {aspect_ratio}, input_images: {input_images}")
        async with HttpClient.create_aiohttp() as session:
            payload = {
                "prompt": prompt,
                "model": model,
                "resolution": resolution,
                "duration": duration,
                "aspect_ratio": aspect_ratio,
                **kwargs
            }

            if input_images:
                payload["input_images"] = input_images

            async with session.post(
                f"{self.api_url}/video/sunra/generations",
                headers=self._build_headers(),
                json=payload,
                timeout=aiohttp.ClientTimeout(total=120.0)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    task_id = data.get('task_id', '')
                    if task_id:
                        logger.info(f"✅ Video task created: {task_id}")
                        return task_id
                    else:
                        raise Exception("No task_id in response")
                else:
                    error_text = await response.text()
                    raise Exception(f"Failed to create video task: HTTP {response.status} - {error_text}")

    async def poll_for_task_completion(
        self,
        task_id: str,
        max_attempts: Optional[int] = None,
        interval: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        等待任务完成并返回结果

        Args:
            task_id: 任务 ID
            max_attempts: 最大轮询次数
            interval: 轮询间隔（秒）

        Returns:
            Dict[str, Any]: 任务结果

        Raises:
            Exception: 当任务失败或超时时抛出异常
        """
        max_attempts = max_attempts or 150  # 默认最多轮询 150 次
        interval = interval or 2.0  # 默认轮询间隔 2 秒

        async with HttpClient.create_aiohttp() as session:
            for _ in range(max_attempts):
                async with session.get(
                    f"{self.api_url}/task/{task_id}",
                    headers=self._build_headers(),
                    timeout=aiohttp.ClientTimeout(total=20.0)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get('success') and data.get('data', {}).get('found'):
                            task = data['data']['task']
                            status = task.get('status')

                            if status == 'succeeded':
                                logger.info(f"✅ Task {task_id} completed successfully")
                                return task
                            elif status == 'failed':
                                error_msg = task.get('error', 'Unknown error')
                                raise Exception(f"Task failed: {error_msg}")
                            elif status == 'cancelled':
                                raise Exception("Task was cancelled")
                            elif status == 'processing':
                                # 继续轮询
                                await asyncio.sleep(interval)
                                continue
                            else:
                                raise Exception(f"Unknown task status: {status}")
                        else:
                            raise Exception("Task not found")
                    else:
                        raise Exception(f"Failed to get task status: HTTP {response.status}")

            raise Exception(f"Task polling timeout after {max_attempts} attempts")

    async def generate_magic_image(self, system_prompt: str, image_content: str, user_info: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        生成魔法图像的完整流程

        Args:
            system_prompt: 系统提示词
            image_content: 图片内容（base64 或 URL）
            user_info: 用户信息，包含email和uuid等

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果，失败时返回包含 error 信息的字典
        """
        try:
            # 1. 图片意图识别, 创建图片分析器实例
            analyser = ImageAnalyser()
            logger.info(f"👇generate_magic_image system_prompt: {system_prompt}")
            if image_content.startswith('data:image/'): 
                try:
                    # 分析图片意图
                    analysis_result = await analyser.analyze_image_base64(system_prompt, image_content)
                    if analysis_result:
                        try:
                            result_json = json.loads(analysis_result)
                            magic_prompt = result_json.get('prompt', 'enhance the image with magical effects')
                        except json.JSONDecodeError:
                            magic_prompt = analysis_result
                    else:
                        magic_prompt = "enhance the image with magical effects"
                    
                    logger.info(f"✅ 图片意图分析完成: {magic_prompt}")
                except Exception as e:
                    logger.error(f"❌ 图片意图分析失败: {e}")
                    return {"error": "Failed to analyze image intent"}
            else:
                magic_prompt = "enhance the image with magical effects"
                logger.error("⚠️ 无法解析图片格式，使用默认提示词")
            
            # 将图片内容写入用户目录
            from services.config_service import get_user_files_dir
            
            # 生成唯一文件名
            file_id = str(uuid.uuid4())
            
            # 获取用户文件目录（使用和chat接口相同的逻辑）
            user_email = user_info.get('email') if user_info else None
            user_id = user_info.get('uuid') if user_info else None
            user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
            
            if image_content.startswith('data:image/'):
                # 从data URL中提取格式和数据
                header, encoded = image_content.split(',', 1)
                image_format = header.split(';')[0].split('/')[1]  # 获取图片格式(jpeg, png等)
                image_data = base64.b64decode(encoded)
                file_path = os.path.join(user_files_dir, f"{file_id}.{image_format}")
            else:
                # 假设是其他格式，默认保存为jpg
                image_data = image_content.encode() if isinstance(image_content, str) else image_content
                file_path = os.path.join(user_files_dir, f"{file_id}.jpg")
            
            # 写入文件
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            logger.info(f"✅ 图片已保存到: {file_path}")

            # 2. nano-banana模型，创建魔法任务
            result = await analyser.generate_magic_image([file_path], magic_prompt)
            if result:
                logger.info(f"✅ Magic image generated successfully: {result.get('result_url')}")
            else:
                logger.error("❌ Failed to generate magic image")
                return {"error": "Failed to generate magic image"}
            return result
        except Exception as e:
            error_msg = f"Error in magic image generation: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {"error": error_msg}

    async def generate(self, model_name:str, user_prompt: str, image_content: str, user_info: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]] | str:
        """
        生成魔法图像的完整流程

        Args:
            image_content: 图片内容（base64 或 URL）

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果，失败时返回包含 error 信息的字典
        """
        try:
            if model_name == "gemini-2.5-flash-image":
                if image_content:
                    from services.config_service import get_user_files_dir
                    
                    # 生成唯一文件名
                    file_id = str(uuid.uuid4())
                    
                    # 获取用户文件目录
                    user_email = user_info.get('email') if user_info else None
                    user_id = user_info.get('uuid') if user_info else None
                    user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
            
                    if image_content and image_content.startswith('data:image/'):
                        # 从data URL中提取格式和数据
                        header, encoded = image_content.split(',', 1)
                        image_format = header.split(';')[0].split('/')[1]  # 获取图片格式(jpeg, png等)
                        image_data = base64.b64decode(encoded)
                        file_path = os.path.join(user_files_dir, f"{file_id}.{image_format}")
                    else:
                        # 假设是其他格式，默认保存为jpg
                        image_data = image_content.encode()
                        file_path = os.path.join(user_files_dir, f"{file_id}.jpg")
            
                    # 写入文件
                    with open(file_path, 'wb') as f:
                        f.write(image_data)
            
                    logger.info(f"✅ 图片已保存到: {file_path}")
                    result = await self.gemini_edit_image_by_tuzi([file_path], user_prompt)
                else:
                    result = await self.gemini_generate_by_tuzi(user_prompt)
                
                if result:
                    logger.info(f"✅ Magic image generated successfully: {result.get('result_url')}")
                    return result
                else:
                    logger.error("❌ Failed to generate magic image")
                    return {"error": "Failed to generate magic image"}
            elif model_name == "gpt-4o":
                # GPT-4o 文本对话模式
                logger.info(f"🔍 [DEBUG] 使用 gpt-4o 进行文本对话")
                try:
                    text_response = await self.gpt_by_tuzi(user_prompt, model_name, user_info)
                    if text_response:
                        # 返回文本响应，格式化为与图像生成一致的结构
                        logger.info(f"✅ GPT-4o 文本对话成功")
                        return text_response
                    else:
                        logger.error("❌ GPT-4o 文本对话失败")
                        return {"error": "GPT-4o text conversation failed"}
                except Exception as e:
                    logger.error(f"❌ GPT-4o 处理出错: {e}")
                    return {"error": f"GPT-4o error: {str(e)}"}
            
        except Exception as e:
            error_msg = f"Error in magic image generation: {str(e)}"
            print(f"❌ {error_msg}")
            return {"error": error_msg}

    async def gpt_by_tuzi(
        self,
        prompt: str,
        model: str = "gpt-4o",
        user_info: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        使用 GPT 模型进行文本对话或图片生成
        
        Args:
            prompt: 用户输入的文本
            model: 使用的模型名称
            user_info: 用户信息，用于保存图片到正确目录
            
        Returns:
            文本响应内容或包含图片URL的响应
        """
        try:
            logger.info(f"🔍 [DEBUG] gpt_by_tuzi 参数:")
            logger.info(f"   prompt: {prompt}")
            logger.info(f"   model: {model}")
            logger.info(f"   base_url: {self.api_url}")     
            # 检查是否需要进行图片生成 - 使用简单的关键词检测，避免额外的API调用
            image_keywords = ["画", "绘", "生成图片", "制作图片", "创建图片", "draw", "paint", "generate image", "create image", "make image", "图"]
            needs_image_generation = any(keyword in prompt.lower() for keyword in image_keywords)
            
            logger.info(f"🤖 [DEBUG] 关键词检测结果: 需要图片生成: {needs_image_generation}")
            logger.info(f"🔍 [DEBUG] 用户输入: {prompt}")

            if needs_image_generation:
                logger.info(f"🎨 [DEBUG] 使用图片生成模式")
                return await self._generate_image_with_gpt(prompt, model, user_info)
            else:
                logger.info(f"💬 [DEBUG] 使用文本对话模式")
                return await self._chat_with_gpt(prompt, model)
            
        except Exception as e:
            logger.error(f"❌ GPT 调用失败: {e}")
            return None

    async def _chat_with_gpt(self, prompt: str, model: str) -> Optional[Dict[str, Any]]:
        """GPT 文本对话"""
        logger.info(f"🚀 [DEBUG] 调用 client.chat.completions.create...")

        client = AsyncOpenAI(
                api_key=self.api_token,
                base_url=self.api_url,
                timeout=60.0  # 设置60秒超时
            )
        
        completion = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        if completion.choices and len(completion.choices) > 0:
            response_content = completion.choices[0].message.content
            if response_content:
                logger.info(f"✅ [DEBUG] GPT 响应: {response_content[:100]}...")
                return {
                    'text_content': response_content,
                    'type': 'text'
                }
            else:
                logger.error("❌ GPT 响应内容为空")
                return None
        else:
            logger.error("❌ GPT 响应没有choices")
            return None

    async def _generate_image_with_gpt(self, prompt: str, model: str, user_info: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]] | str:
        """GPT 图片生成并保存到用户目录""" 
        logger.info(f"🚀 [DEBUG] 调用 client.images.generate...")
        logger.info(f"🔍 [DEBUG] 使用模型: {model}")
        logger.info(f"🔍 [DEBUG] 提示词: {prompt}")
        logger.info(f"🔍 [DEBUG] API地址: {self.api_url}")

        try:
            client = AsyncOpenAI(
                api_key=self.api_token,
                base_url=self.api_url,
                timeout=30.0,  # 增加到3分钟，确保足够的时间生成图片
                max_retries=0   # 禁用重试，避免重复调用和额外日志
            )
            
            logger.info(f"🚀 [DEBUG] AsyncOpenAI 客户端创建成功，开始调用...")
            
            result = await client.images.generate(
                model=model,
                prompt=prompt
            )
            
            logger.info(f"✅ [DEBUG] 图片生成API调用成功")
            
        except Exception as e:
            logger.error(f"❌ [ERROR] 图片生成API调用失败: {e}")
            # 导入错误消息工具
            from utils.error_messages import get_user_friendly_error
            friendly_message = get_user_friendly_error(str(e))
            logger.info(f"🔄 [DEBUG] 返回用户友好错误消息: {friendly_message}")
            return friendly_message
        
        response_data: Dict[str, Any] = {}
        if result.data and len(result.data) > 0:
            image_data = result.data[0]
            
            # 获取图片URL
            if hasattr(image_data, 'url') and image_data.url:
                image_url = image_data.url
                logger.info(f"✅ [DEBUG] GPT 图片生成成功: {image_url}")
                
                # 保存图片到用户目录
                try:
                    # 获取用户文件目录
                    # user_email = user_info.get('email') if user_info else None
                    # user_id = user_info.get('uuid') if user_info else None
                    # user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
                    
                    # # 生成唯一文件名
                    # file_id = generate(size=10)
                    # file_path_without_extension = os.path.join(user_files_dir, file_id)
                    
                    # # 下载并保存图片
                    # mime_type, width, height, extension = await get_image_info_and_save(
                    #     image_url, file_path_without_extension, is_b64=False
                    # )
                    
                    # filename = f'{file_id}.{extension}'
                    # logger.info(f"✅ GPT 图片已保存到用户目录: {filename}")
                    
                    # # 返回本地文件链接格式
                    # from common import DEFAULT_PORT
                    # local_image_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"
                    response_data['result_url'] = image_url
                    response_data['type'] = 'image'
                    return response_data
                    # return f"✨ GPT Image Generated Successfully\n\n![image_id: {filename}]({local_image_url})"
                    
                except Exception as e:
                    logger.error(f"❌ 保存 GPT 图片失败: {e}")
                    return None
            else:
                logger.error("❌ GPT 图片响应无URL")
                return None
        else:
            logger.error("❌ GPT 图片生成失败")
            return None

    async def gemini_edit_image_by_tuzi(
        self,
        file_path: list[str],
        prompt: str,
        model: str = "gemini-2.5-flash-image"
    ) -> Optional[Dict[str, str]]:
        """
        生成魔法图片

        Args:
            prompt: 图片生成提示词
            model: 使用的模型

        Returns:
            Optional[Dict[str, str]]: 包含 base64 或 url 的字典，失败时返回None
        """
        try:
            # 创建 OpenAI 客户端
            client = AsyncOpenAI(
                base_url=self.api_url,
                api_key=self.api_token,
                timeout=180.0,  # 增加到3分钟，确保足够的时间
                max_retries=0   # 禁用重试，保持一致性
            )
            
            # 打印详细的调试信息
            logger.info(f"🔍 [DEBUG] edit_image_by_tuzi 参数:")
            logger.info(f"   prompt: {prompt}")
            logger.info(f"   model: {model}")
            logger.info(f"   file_path: {file_path}")
            logger.info(f"   base_url: {self.api_url}")
            logger.info(f"   api_key: {self.api_token[:10]}***")
            
            # 生成图片
            images: list[Any] = []
            for f in file_path:
                images.append(open(f, 'rb'))
            
            logger.info(f"🚀 [DEBUG] 调用 client.images.edit...")
            logger.info(f"   images 数量: {len(images)}")
            
            result = await client.images.edit(
                model=model,
                image=images,
                prompt=prompt
            )
            
            # 打印完整的响应数据
            logger.info(f"📥 [DEBUG] API 响应原始数据:")
            logger.info(f"   result.data 长度: {len(result.data) if result.data else 0}")
            if result.data:
                for i, data in enumerate(result.data):
                    logger.info(f"   data[{i}] 属性: {dir(data)}")
                    logger.info(f"   data[{i}] 内容: {data}")
                    if hasattr(data, '__dict__'):
                        logger.info(f"   data[{i}] __dict__: {data.__dict__}")
                    if hasattr(data, 'url'):
                        logger.info(f"   data[{i}].url: {data.url}")
                    if hasattr(data, 'b64_json'):
                        logger.info(f"   data[{i}].b64_json: {'存在' if data.b64_json else '不存在'}")
                    if hasattr(data, 'revised_prompt'):
                        logger.info(f"   data[{i}].revised_prompt: {data.revised_prompt}")

            if result.data and len(result.data) > 0:
                image_data = result.data[0]
                # 返回结果字典
                response_data: Dict[str, str] = {}
                
                logger.info(f"🔍 [DEBUG] edit_image - 处理第一个图片数据:")
                logger.info(f"   type(image_data): {type(image_data)}")
                
                # 检查是否有 base64 数据
                if hasattr(image_data, 'b64_json'):
                    logger.info(f"   b64_json 属性存在: {image_data.b64_json is not None}")
                    if image_data.b64_json:
                        response_data['image_base64'] = image_data.b64_json
                        logger.info(f"✅ Image edited with base64 data")
                else:
                    logger.info(f"   无 b64_json 属性")
                
                # 检查是否有 URL
                if hasattr(image_data, 'url'):
                    logger.info(f"   url 属性存在: {image_data.url}")
                    if image_data.url:
                        response_data['result_url'] = image_data.url
                        logger.info(f"✅ Image edited with URL: {image_data.url}")
                else:
                    logger.info(f"   无 url 属性")
                
                # 尝试其他可能的属性
                for attr in ['image', 'data', 'content', 'image_url', 'image_data']:
                    if hasattr(image_data, attr):
                        value = getattr(image_data, attr)
                        logger.info(f"   发现额外属性 {attr}: {value}")
                        if value and attr not in ['image', 'data']:  # 避免处理文件对象
                            response_data[f'found_{attr}'] = str(value)
                
                logger.info(f"🎯 [DEBUG] edit_image - 最终 response_data: {response_data}")
                
                if response_data:
                    return response_data
                else:
                    logger.error("❌ No image data returned")
                    return None
            else:
                logger.error("❌ No image data in response")
                return None
        except Exception as e:
            print(f"❌ Error generating image: {e}")
            return None

    async def gemini_generate_by_tuzi(
        self,
        prompt: str,
        model: str = "gemini-2.5-flash-image"
    ) -> Optional[Dict[str, str]]:
        """
        生成魔法图片

        Args:
            prompt: 图片生成提示词
            model: 使用的模型

        Returns:
            Optional[Dict[str, str]]: 包含 base64 或 url 的字典，失败时返回None
        """
        try:
            # 创建 OpenAI 客户端
            client = AsyncOpenAI(
                base_url=self.api_url,
                api_key=self.api_token,
                timeout=180.0,  # 增加到3分钟，确保足够的时间
                max_retries=0   # 禁用重试，保持一致性
            )
            
            # 打印详细的调试信息
            logger.info(f"🔍 [DEBUG] generate_by_tuzi 参数:")
            logger.info(f"   prompt: {prompt}")
            logger.info(f"   model: {model}")
            logger.info(f"   base_url: {self.api_url}")
            logger.info(f"   api_key: {self.api_token[:10]}***")
            
            # 生成图片
            logger.info(f"🚀 [DEBUG] 调用 client.images.generate...")
            logger.info(f"🔍 [DEBUG] 传递给API的模型名称: '{model}'")
            logger.info(f"🔍 [DEBUG] 传递给API的提示词: '{prompt}'")
            logger.info(f"🔍 [DEBUG] API调用URL: {self.api_url}/images/generations")
            image_model = model
            logger.info(f"🎯 [DEBUG] 最终使用的图像生成模型: {image_model}")
            
            result = await client.images.generate(
                model=image_model,
                prompt=prompt
            )
            
            # 打印完整的响应数据
            logger.info(f"📥 [DEBUG] API 响应原始数据:")
            logger.info(f"   result.data 长度: {len(result.data) if result.data else 0}")
            if result.data:
                for i, data in enumerate(result.data):
                    logger.info(f"   data[{i}] 属性: {dir(data)}")
                    logger.info(f"   data[{i}] 内容: {data}")
                    if hasattr(data, '__dict__'):
                        logger.info(f"   data[{i}] __dict__: {data.__dict__}")
                    if hasattr(data, 'url'):
                        logger.info(f"   data[{i}].url: {data.url}")
                    if hasattr(data, 'b64_json'):
                        logger.info(f"   data[{i}].b64_json: {'存在' if data.b64_json else '不存在'}")
                    if hasattr(data, 'revised_prompt'):
                        logger.info(f"   data[{i}].revised_prompt: {data.revised_prompt}")
            if result.data and len(result.data) > 0:
                image_data = result.data[0]
                # 返回结果字典
                response_data: Dict[str, str] = {}
                
                logger.info(f"🔍 [DEBUG] 处理第一个图片数据:")
                logger.info(f"   type(image_data): {type(image_data)}")
                
                # 检查是否有 base64 数据
                if hasattr(image_data, 'b64_json'):
                    logger.info(f"   b64_json 属性存在: {image_data.b64_json is not None}")
                    if image_data.b64_json:
                        response_data['image_base64'] = image_data.b64_json
                        logger.info(f"✅ Image generated with base64 data")
                else:
                    logger.info(f"   无 b64_json 属性")
                
                # 检查是否有 URL
                if hasattr(image_data, 'url'):
                    logger.info(f"   url 属性存在: {image_data.url}")
                    if image_data.url:
                        response_data['result_url'] = image_data.url
                        logger.info(f"✅ Image generated with URL: {image_data.url}")
                else:
                    logger.info(f"   无 url 属性")
                
                # 尝试其他可能的属性
                for attr in ['image', 'data', 'content', 'image_url', 'image_data']:
                    if hasattr(image_data, attr):
                        value = getattr(image_data, attr)
                        logger.info(f"   发现额外属性 {attr}: {value}")
                        if value and attr not in ['image', 'data']:  # 避免处理文件对象
                            response_data[f'found_{attr}'] = str(value)
                
                logger.info(f"🎯 [DEBUG] 最终 response_data: {response_data}")
                
                if response_data:
                    return response_data
                else:
                    logger.error("❌ No image data returned")
                    return None
            else:
                logger.error("❌ No image data in response")
                return None
        except Exception as e:
            print(f"❌ Error generating image: {e}")
            return None


    async def generate_video(
        self,
        prompt: str,
        model: str,
        resolution: Optional[str] = None,
        duration: Optional[int] = None,
        aspect_ratio: Optional[str] = None,
        input_images: Optional[List[str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        生成视频的完整流程

        Args:
            prompt: 视频生成提示词
            model: 视频生成模型
            resolution: 视频分辨率
            duration: 视频时长（秒）
            aspect_ratio: 宽高比
            input_images: 输入图片列表（可选）
            **kwargs: 其他参数

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果

        Raises:
            Exception: 当视频生成失败时抛出异常
        """
        # 1. 创建视频生成任务
        task_id = await self.create_video_task(
            prompt=prompt,
            model=model,
            resolution=resolution,
            duration=duration,
            aspect_ratio=aspect_ratio,
            input_images=input_images,
            **kwargs
        )

        if not task_id:
            raise Exception("Failed to create video task")

        # 2. 等待任务完成
        result = await self.poll_for_task_completion(task_id)
        if not result:
            raise Exception("Video generation failed")

        if result.get('error'):
            raise Exception(f"Video generation failed: {result['error']}")

        if not result.get('result_url'):
            raise Exception("No result URL found in video generation response")

        logger.info(f"✅ Video generated successfully: {result.get('result_url')}")
        return result

    async def generate_video_by_seedance(
        self,
        prompt: str,
        model: str,
        resolution: str = "480p",
        duration: int = 5,
        aspect_ratio: str = "16:9",
        input_images: Optional[List[str]] = None,
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        使用 Seedance 模型生成视频的完整流程

        Args:
            prompt: 视频生成提示词
            model: 视频生成模型
            resolution: 视频分辨率
            duration: 视频时长（秒）
            aspect_ratio: 宽高比
            input_images: 输入图片列表（可选）
            **kwargs: 其他参数

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果

        Raises:
            Exception: 当视频生成失败时抛出异常
        """
        # 1. 创建 Seedance 视频生成任务
        async with HttpClient.create_aiohttp() as session:
            payload = {
                "prompt": prompt,
                "model": model,
                "resolution": resolution,
                "duration": duration,
                "aspect_ratio": aspect_ratio,
                **kwargs
            }

            if input_images:
                payload["input_images"] = input_images

            async with session.post(
                f"{self.api_url}/video/seedance/generation",
                headers=self._build_headers(),
                json=payload,
                timeout=aiohttp.ClientTimeout(total=120.0)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    task_id = data.get('task_id', '')
                    if not task_id:
                        raise Exception("No task_id in response")
                else:
                    error_text = await response.text()
                    raise Exception(f"Failed to create Seedance video task: HTTP {response.status} - {error_text}")

        logger.info(f"✅ Seedance video task created: {task_id}")

        # 2. 等待任务完成
        result = await self.poll_for_task_completion(task_id)
        if not result:
            raise Exception("Seedance video generation failed")

        if result.get('error'):
            raise Exception(f"Seedance video generation failed: {result['error']}")

        if not result.get('result_url'):
            raise Exception("No result URL found in Seedance video generation response")

        logger.info(f"✅ Seedance video generated successfully: {result.get('result_url')}")
        return result

    async def create_midjourney_task(
        self,
        prompt: str,
        model: str = "midjourney",
        **kwargs: Any
    ) -> str:
        """
        创建云端 Midjourney 图像生成任务

        Args:
            prompt: 图像生成提示词
            model: 图像生成模型（默认为 midjourney）
            **kwargs: 其他参数（如 mode 等）

        Returns:
            str: 任务 ID

        Raises:
            Exception: 当任务创建失败时抛出异常
        """
        async with HttpClient.create_aiohttp() as session:
            payload = {
                "prompt": prompt,
                "model": model,
                **kwargs
            }

            async with session.post(
                f"{self.api_url}/image/midjourney/generation",
                headers=self._build_headers(),
                json=payload,
                timeout=aiohttp.ClientTimeout(total=60.0)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    task_id = data.get('task_id', '')
                    if task_id:
                        logger.info(f"✅ Midjourney task created: {task_id}")
                        return task_id
                    else:
                        raise Exception("No task_id in response")
                else:
                    error_text = await response.text()
                    raise Exception(f"Failed to create Midjourney task: HTTP {response.status} - {error_text}")

    async def generate_image_by_midjourney(
        self,
        prompt: str,
        model: str = "midjourney",
        **kwargs: Any
    ) -> Dict[str, Any]:
        """
        使用 Midjourney 生成图像的完整流程

        Args:
            prompt: 图像生成提示词
            model: 图像生成模型（默认为 midjourney）
            **kwargs: 其他参数（如 mode 等）

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果

        Raises:
            Exception: 当图像生成失败时抛出异常
        """
        # 1. 创建 Midjourney 图像生成任务
        task_id = await self.create_midjourney_task(
            prompt=prompt,
            model=model,
            **kwargs
        )

        if not task_id:
            raise Exception("Failed to create Midjourney task")

        # 2. 等待任务完成
        task_result = await self.poll_for_task_completion(task_id, max_attempts=150, interval=2.0)
        logger.info(f"🎨 Midjourney task result: {task_result}")
        if not task_result:
            raise Exception("Midjourney image generation failed")

        if task_result.get('error'):
            raise Exception(f"Midjourney image generation failed: {task_result['error']}")

        if not task_result.get('result'):
            raise Exception("No result found in Midjourney image generation response")

        result = task_result.get('result')
        logger.info(f"✅ Midjourney image generated successfully: {result}")
        return result or {}

    def is_configured(self) -> bool:
        """
        检查服务是否已正确配置

        Returns:
            bool: 配置是否有效
        """
        return self._is_configured()
