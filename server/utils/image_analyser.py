from argparse import FileType
import base64
import aiohttp
import sys
import os
from typing import Optional, Dict
from openai import OpenAI   

# 添加父目录到路径以便导入 services 模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from services.config_service import config_service


class ImageAnalyser:
    """图片意图理解分析器"""

    def __init__(self):
        """初始化图片分析器"""
        config = config_service.app_config.get('openai', {})
        self.api_url = str(config.get("url", "")).rstrip("/")
        self.api_token = "sk-Ipb6VHeNkbBOrAzuq2JJBg76G5Qu9b6sU1LdDRlmQWCq0oKU"

        if not self.api_url:
            raise ValueError("openai API URL is not configured")
        if not self.api_token:
            raise ValueError("openai API token is not configured")

        # 确保 API 地址正确
        if not self.api_url.endswith('/v1'):
            self.api_url = f"{self.api_url}/v1"

    def _build_headers(self) -> Dict[str, str]:
        """构建请求头"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_token}"
        }

    def _encode_image(self, image_path: str) -> str:
        """将图片文件编码为base64字符串"""
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    async def analyze_image_intent(
        self, 
        image_path: str, 
        prompt: str = """
你是一个专业的图像处理专家，擅长分析图片，解析图片内容，并根据用户在图片中的标注进行意图理解，最终生成一段nana-banana模型使用的图片处理提示词

# 图片处理约定
1. 分析图片中的主体，并保留主体要素
2. 分析图片中的标记，比如红色圆圈，文字等
3. 理解用户意图，意图一般是文字和线条组成

# 输出约定
返回json格式，比如:
{
  "prompt": "this is ...."
}        
""",
        model: str = "gemini-2.5-pro",
        max_tokens: int = 3000
    ) -> Optional[str]:
        """
        分析图片意图

        Args:
            image_path: 图片文件路径
            prompt: 分析提示词
            model: 使用的模型
            max_tokens: 最大token数

        Returns:
            Optional[str]: 分析结果文本，失败时返回None
        """
        try:
            # 编码图片
            base64_image = self._encode_image(image_path)
            
            # 构建请求payload
            payload = {
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url", 
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": max_tokens
            }

            # 发送请求
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url}/chat/completions",
                    headers=self._build_headers(),
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60.0)
                ) as response:
                    if response.status == 200:
                        response_data = await response.json()
                        
                        # 提取文本内容
                        choices = response_data.get('choices', [])
                        if choices and len(choices) > 0:
                            content = choices[0].get('message', {}).get('content', '')
                            return content
                        else:
                            print("❌ No choices in response")
                            return None
                    else:
                        error_text = await response.text()
                        print(f"❌ Failed to analyze image: {response.status} - {error_text}")
                        return None

        except Exception as e:
            print(f"❌ Error analyzing image: {e}")
            return None

    async def analyze_image_base64(
        self,
        system_prompt: str,
        base64_image: str,
        prompt: str = """
你是一个专业的图像处理专家，擅长分析图片，解析图片内容，并根据用户在图片中的标注进行意图理解，最终生成一段nana-banana模型使用的图片处理提示词

# 图片处理约定
1. 分析图片中的主体，并保留主体要素
2. 分析图片中的标记，比如红色圆圈，文字等
3. 理解用户意图，意图一般是文字和线条组成
4. 最终输出一张成品图片的提示词

# 输出约定
返回json格式，比如:
{
  "prompt": "this is ...."
}    
""",
        model: str = "gemini-2.5-flash-image", 
        max_tokens: int = 3000
    ) -> Optional[str]:
        """
        分析base64编码的图片

        Args:
            base64_image: base64编码的图片数据
            prompt: 分析提示词
            model: 使用的模型
            max_tokens: 最大token数

        Returns:
            Optional[str]: 分析结果文本，失败时返回None
        """
        try:
            # 构建请求payload
            payload = {
                "model": model,
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "system",
                                "text": system_prompt
                            }
                        ]
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": base64_image if base64_image.startswith('data:image/') else f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": max_tokens
            }

            # 发送请求
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_url}/chat/completions",
                    headers=self._build_headers(),
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=60.0)
                ) as response:
                    if response.status == 200:
                        response_data = await response.json()

                        print(f"✅ Image analysis response data: {response_data}")
                        
                        # 提取文本内容
                        choices = response_data.get('choices', [])
                        if choices and len(choices) > 0:
                            content = choices[0].get('message', {}).get('content', '')
                            print(f"✅ Image analysis result: {content}")
                            return content
                        else:
                            print("❌ No choices in response")
                            return None
                    else:
                        error_text = await response.text()
                        print(f"❌ Failed to analyze image: {response.status} - {error_text}")
                        return None
        except Exception as e:
            print(f"❌ Error analyzing image: {e}")
            return None
        
    async def generate_magic_image(
        self,
        file_path: str,
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
            client = OpenAI(
                base_url=self.api_url,
                api_key=self.api_token
            )
            # 生成图片
            result = client.images.edit(
                model=model,
                image=[open(file_path, 'rb')],
                prompt=prompt
            )

            if result.data and len(result.data) > 0:
                image_data = result.data[0]
                # 返回结果字典
                response_data: Dict[str, str] = {}    
                if hasattr(image_data, 'url') and image_data.url:
                    response_data['result_url'] = image_data.url
                    print(f"✅ Image generated with URL: {image_data.url}")
                if response_data:
                    return response_data
                else:
                    print("❌ No image data returned")
                    return None
            else:
                print("❌ No image data in response")
                return None
        except Exception as e:
            print(f"❌ Error generating image: {e}")
            return None

if __name__ == "__main__":
    import asyncio
    analyser = ImageAnalyser()
    result = asyncio.run(analyser.analyze_image_intent("/Users/caijunjie/Downloads/下载.png"))
    print(result)