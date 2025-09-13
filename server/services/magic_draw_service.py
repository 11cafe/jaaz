# services/OpenAIAgents_service/jaaz_service.py
import base64
from email.mime import image
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

logger = get_logger(__name__)

class MagicDrawService:
    """基于兔子API的本地MagicDraw服务
    """

    def __init__(self):
        """初始化 Jaaz 服务"""
        config = config_service.app_config.get('openai', {})
        self.api_url = str(config.get("url", "")).rstrip("/")
        self.api_token = str(config.get("api_key", ""))

        if not self.api_url:
            raise ValueError("Jaaz API URL is not configured")
        if not self.api_token:
            raise ValueError("Jaaz API token is not configured")

        # 确保 API 地址以 /api/v1 结尾
        if not self.api_url.endswith('/api/v1'):
            self.api_url = f"{self.api_url}/api/v1"

        logger.info(f"✅ Jaaz service initialized with API URL: {self.api_url}")

    def _is_configured(self) -> bool:
        """检查 Jaaz API 是否已配置"""
        return bool(self.api_url and self.api_token)

    def _build_headers(self) -> Dict[str, str]:
        """构建请求头"""
        return {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
    
    def _extract_json_from_markdown(self, content: str) -> str:
        """从markdown代码块中提取JSON内容"""
        import re
        
        # 尝试匹配 ```json ... ``` 格式
        json_match = re.search(r'```json\s*(.*?)\s*```', content, re.DOTALL)
        if json_match:
            return json_match.group(1).strip()
        
        # 尝试匹配 ``` ... ``` 格式（没有指定language）
        code_match = re.search(r'```\s*(.*?)\s*```', content, re.DOTALL)
        if code_match:
            return code_match.group(1).strip()
        
        # 如果没有代码块，直接返回原内容
        return content.strip()
    
    def _extract_prompt_fallback(self, content: str) -> str:
        """当JSON解析失败时的后备prompt提取方法"""
        import re
        
        # 尝试查找 "prompt": "..." 模式
        prompt_match = re.search(r'"prompt"\s*:\s*"([^"]*)"', content)
        if prompt_match:
            return prompt_match.group(1)
        
        # 尝试查找可能的prompt描述文本
        if 'detailed' in content.lower() and 'sketch' in content.lower():
            # 如果包含详细描述，截取前200个字符作为prompt
            clean_content = re.sub(r'[{}"\[\]`]', '', content)
            return clean_content[:200].strip()
        
        # 如果都没找到，返回默认prompt
        return "enhance the image with magical effects"

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
            # 分析传入的图片内容格式
            logger.info(f"[Magic Draw] 开始生成魔法图片")
            logger.info(f"[Magic Draw] 图片内容长度: {len(image_content)}")
            
            if image_content.startswith('data:image/'):
                # 提取MIME类型信息
                mime_part = image_content.split(',')[0] if ',' in image_content else 'unknown'
                logger.info(f"[Magic Draw] 检测到data URL格式: {mime_part}")
            else:
                logger.warning(f"[Magic Draw] 未检测到data URL格式，内容开头: {image_content[:50]}...")
            
            # 1. 图片意图识别, 创建图片分析器实例
            analyser = ImageAnalyser()
            logger.info(f"[Magic Draw] system_prompt长度: {len(system_prompt)}")
            
            if image_content.startswith('data:image/'): 
                try:
                    logger.info(f"[Magic Draw] 开始分析图片意图...")
                    # 分析图片意图
                    magic_prompt = "Generate a new picture based on the picture input by the user"
                    # analysis_result = await analyser.analyze_image_base64(system_prompt, image_content)
                    # if analysis_result:
                    #     logger.info(f"[Magic Draw] 图片分析返回结果: {analysis_result[:200]}...")
                    #     try:
                    #         # 提取markdown代码块中的JSON内容
                    #         json_content = self._extract_json_from_markdown(analysis_result)
                    #         result_json = json.loads(json_content)
                    #         magic_prompt = result_json.get('prompt', 'enhance the image with magical effects')
                    #         logger.info(f"[Magic Draw] 解析JSON成功，提取prompt: {magic_prompt[:100]}...")
                    #     except (json.JSONDecodeError, ValueError) as json_error:
                    #         logger.warning(f"[Magic Draw] JSON解析失败: {json_error}，尝试直接使用返回内容")
                    #         # 如果JSON解析失败，尝试提取可能的prompt文本
                    #         magic_prompt = self._extract_prompt_fallback(analysis_result)
                    # else:
                    #     logger.warning(f"[Magic Draw] 图片分析返回空结果，使用默认prompt")
                    #     magic_prompt = "enhance the image with magical effects"
                    logger.info(f"✅ 图片意图分析完成: {magic_prompt}")
                except Exception as e:
                    logger.error(f"❌ 图片意图分析失败: {e}")
                    logger.error(f"[Magic Draw] 分析失败详情: {type(e).__name__}: {str(e)}")
                    return {"error": "Failed to analyze image intent"}
            else:
                magic_prompt = "enhance the image with magical effects"
                logger.warning("⚠️ 无法解析图片格式，使用默认提示词")
            
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
                image_data = image_content.encode()
                file_path = os.path.join(user_files_dir, f"{file_id}.jpg")
            
            # 写入文件
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            logger.info(f"✅ 图片已保存到: {file_path}")

            imeages = {
                "image": file_path,
                "mask": ""
            }
            # 2. nano-banana模型，创建魔法任务
            result = await analyser.generate_magic_image(imeages, magic_prompt)
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

    async def generate_template_image(self, 
                             user_prompt: str, 
                             image_content: str, 
                             template_image: str, 
                             user_info: Optional[Dict[str, Any]] = None,
                             use_mask: int = 0,
                             is_image: int = 0,
                             session_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        生成魔法图像的完整流程

        Args:
            user_prompt: 用户提示词
            image_content: 图片内容（base64 或 URL）
            template_id: 模板ID
            user_info: 用户信息，包含email和uuid等

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果，失败时返回包含 error 信息的字典
        """
        try:
            logger.info("generate_image")
            
            # 获取用户文件目录
            from services.config_service import get_user_files_dir
            
            user_email = user_info.get('email') if user_info else None
            user_id = user_info.get('uuid') if user_info else None
            user_files_dir = get_user_files_dir(user_email=user_email, user_id=user_id)
            
            # 使用用户提示词作为魔法提示词
            magic_prompt = user_prompt if user_prompt else "enhance the image with magical effects"
            
            # nano-banana模型，创建魔法任务
            analyser = ImageAnalyser()
            # 生成唯一文件名
            file_id = str(uuid.uuid4())
            images = {
                "image": "",
                "mask": ""
            }
            
            if image_content.startswith('data:image/'):
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

            # 处理模板图片
            template_file_path = None
            if use_mask == 1:
                # 构建模板图片的完整路径
                template_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), template_image.lstrip('/'))
                logger.info(f"📝 模板图片路径: {template_file_path}")
                
                # 检查模板文件是否存在
                if not os.path.exists(template_file_path):
                    logger.error(f"❌ 模板图片不存在: {template_file_path}")
                    return {"error": f"Template image not found: {template_image}"}
                    
                if is_image == 1:
                    images["mask"] = file_path
                    images["image"]= template_file_path
                else:
                    images["image"] = file_path
                    images["mask"] = template_file_path
            else:
                images["image"] = file_path

            result = await analyser.generate_magic_image(images, magic_prompt, session_id=session_id)
            if result:
                logger.info(f"✅ Magic image generated successfully: {result.get('result_url')}")
            else:
                logger.error("❌ Failed to generate magic image")
                return {"error": "Failed to generate magic image"}
            return result
        except Exception as e:
            error_msg = f"Error in magic image generation: {str(e)}"
            print(f"❌ {error_msg}")
            return {"error": error_msg}

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
