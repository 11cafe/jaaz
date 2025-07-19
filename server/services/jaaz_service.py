# services/OpenAIAgents_service/jaaz_service.py

import asyncio
from typing import Dict, Any, Optional
from utils.http_client import HttpClient
from services.config_service import config_service


class JaazService:
    """Jaaz 云端 API 服务
    """

    def __init__(self):
        """初始化 Jaaz 服务"""
        config = config_service.app_config.get('jaaz', {})
        self.api_url = str(config.get("url", "")).rstrip("/")
        self.api_token = str(config.get("api_key", ""))

        if not self.api_url:
            raise ValueError("Jaaz API URL is not configured")
        if not self.api_token:
            raise ValueError("Jaaz API token is not configured")

        # 确保 API 地址以 /api/v1 结尾
        if not self.api_url.endswith('/api/v1'):
            self.api_url = f"{self.api_url}/api/v1"

        print(f"✅ Jaaz service initialized with API URL: {self.api_url}")

    def _is_configured(self) -> bool:
        """检查 Jaaz API 是否已配置"""
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
        try:
            if not image_content or not image_content.startswith('data:image/'):
                print("❌ Invalid image content format")
                return ""

            async with HttpClient.create() as client:
                response = await client.post(
                    f"{self.api_url}/image/magic",
                    headers=self._build_headers(),
                    json={
                        "image": image_content
                    },
                    timeout=30.0
                )

                if response.status_code == 200:
                    data = response.json()
                    task_id = data.get('task_id', '')
                    if task_id:
                        print(f"✅ Magic task created: {task_id}")
                        return task_id
                    else:
                        print("❌ No task_id in response")
                        return ""
                else:
                    error_text = response.text if hasattr(
                        response, 'text') else 'Unknown error'
                    print(
                        f"❌ Failed to create magic task: {response.status_code} - {error_text}")
                    return ""

        except Exception as e:
            print(f"❌ Error creating magic task: {e}")
            return ""

    async def poll_for_task_completion(
        self,
        task_id: str,
        max_attempts: Optional[int] = None,
        interval: Optional[float] = None
    ) -> Optional[Dict[str, Any]]:
        """
        等待任务完成并返回结果

        Args:
            task_id: 任务 ID
            max_attempts: 最大轮询次数
            interval: 轮询间隔（秒）

        Returns:
            Dict[str, Any]: 任务结果，失败时返回包含 error 信息的字典
        """
        max_attempts = max_attempts or 150  # 默认最多轮询 150 次
        interval = interval or 2.0  # 默认轮询间隔 2 秒

        try:
            async with HttpClient.create() as client:
                for attempt in range(max_attempts):
                    response = await client.get(
                        f"{self.api_url}/task/{task_id}",
                        headers=self._build_headers(),
                        timeout=10.0
                    )

                    if response.status_code == 200:
                        data = response.json()
                        if data.get('success') and data.get('data', {}).get('found'):
                            task = data['data']['task']
                            status = task.get('status')

                            # print(
                            #     f"🔄 Task {task_id} status: {status} (attempt {attempt + 1}/{max_attempts})")

                            if status == 'succeeded':
                                print(
                                    f"✅ Task {task_id} completed successfully")
                                return task
                            elif status == 'failed':
                                error_msg = task.get('error', 'Unknown error')
                                print(
                                    f"❌ Task {task_id} failed: {error_msg}")
                                return {"error": f"Task failed: {error_msg}"}
                            elif status == 'cancelled':
                                print(f"❌ Task {task_id} was cancelled")
                                return {"error": "Task was cancelled"}
                            elif status == 'processing':
                                # 继续轮询
                                await asyncio.sleep(interval)
                                continue
                            else:
                                print(
                                    f"❌ Unknown task status: {status}")
                                return {"error": f"Unknown task status: {status}"}
                        else:
                            print(f"❌ Task {task_id} not found")
                            return {"error": "Task not found"}
                    else:
                        print(
                            f"❌ Failed to get task status: {response.status_code}")
                        return {"error": f"Failed to get task status: HTTP {response.status_code}"}

                print(
                    f"❌ Task {task_id} polling timeout after {max_attempts} attempts")
                return {"error": f"Task polling timeout after {max_attempts} attempts"}

        except Exception as e:
            print(f"❌ Error polling task status: {e}")
            return {"error": f"Error polling task status: {str(e)}"}

    async def generate_magic_image(self, image_content: str) -> Optional[Dict[str, Any]]:
        """
        生成魔法图像的完整流程

        Args:
            image_content: 图片内容（base64 或 URL）

        Returns:
            Dict[str, Any]: 包含 result_url 的任务结果，失败时返回包含 error 信息的字典
        """
        try:
            # 1. 创建任务
            task_id = await self.create_magic_task(image_content)
            if not task_id:
                print("❌ Failed to create magic task")
                return {"error": "Failed to create magic task"}

            # 2. 等待任务完成
            result = await self.poll_for_task_completion(task_id)
            if not result:
                print("❌ Magic generation failed")
                return {"error": "Magic generation failed"}

            if not result.get('result_url'):
                error_msg = result.get('error', 'No result URL found')
                print(f"❌ Magic generation failed: {error_msg}")
                return {"error": f"Magic generation failed: {error_msg}"}

            print(
                f"✅ Magic image generated successfully: {result.get('result_url')}")
            return result

        except Exception as e:
            error_msg = f"Error in magic image generation: {str(e)}"
            print(f"❌ {error_msg}")
            return {"error": error_msg}

    def is_configured(self) -> bool:
        """
        检查服务是否已正确配置

        Returns:
            bool: 配置是否有效
        """
        return self._is_configured()
