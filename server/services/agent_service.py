from .config_service import config_service
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from ollama import Client
from utils.http_client import HttpClient

llm_config = config_service.get_config()


class OpenAILLM:
    tools: list[dict] = []
    max_tokens: int = llm_config.get("openai", {}).get("max_tokens", 6140)

    def __init__(self):
        openai_url = llm_config.get("openai", {}).get(
            "url", "https://api.openai.com/v1").rstrip('/')
        # Create HTTP client optimized for OpenAI API
        self.http_client = HttpClient.create_async_client(url=openai_url)
        self.client: AsyncOpenAI = AsyncOpenAI(
            api_key=llm_config.get("openai", {}).get("api_key", ""),
            http_client=self.http_client
        )
        self.api_key = llm_config.get("openai", {}).get("api_key", "")
        self.url = openai_url

    async def close(self):
        """关闭 HTTP 客户端连接"""
        if hasattr(self, 'http_client') and self.http_client:
            await self.http_client.aclose()


class AnthropicLLM:
    tools: list[dict] = []
    max_tokens: int = llm_config.get("anthropic", {}).get("max_tokens", 6140)

    def __init__(self):
        # Anthropic client handles HTTP internally, but we can still optimize
        anthropic_url = llm_config.get("anthropic", {}).get(
            "url", "https://api.anthropic.com/v1").rstrip('/')
        self.http_client = HttpClient.create_async_client(url=anthropic_url)
        self.client: AsyncAnthropic = AsyncAnthropic(
            api_key=llm_config.get("anthropic", {}).get("api_key", ""),
            http_client=self.http_client
        )
        self.api_key = llm_config.get("anthropic", {}).get("api_key", "")
        self.url = anthropic_url

    async def close(self):
        """关闭 HTTP 客户端连接"""
        if hasattr(self, 'http_client') and self.http_client:
            await self.http_client.aclose()


class OllamaLLM:
    tools: list[dict] = []
    max_tokens: int = llm_config.get("ollama", {}).get("max_tokens", 6140)

    def __init__(self):
        # Use optimized client for local Ollama service
        self.url = llm_config.get("ollama", {}).get(
            "url", "http://localhost:11434").rstrip('/')
        self.http_client = HttpClient.create_async_client(url=self.url)
        self._client = None  # 延迟初始化

    @property
    def client(self) -> AsyncOpenAI:
        """延迟初始化客户端"""
        if self._client is None:
            self._client = AsyncOpenAI(
                base_url=self.url + '/v1',
                api_key='ollama',  # required, but unused
                http_client=self.http_client
            )
        return self._client

    async def close(self):
        """关闭 HTTP 客户端连接"""
        if hasattr(self, 'http_client') and self.http_client:
            await self.http_client.aclose()


openai_client = OpenAILLM()
anthropic_client = AnthropicLLM()
ollama_client = OllamaLLM()


async def llm_reload_clients():
    global llm_config
    # refresh llm_config value
    llm_config = config_service.get_config()
    global openai_client
    global anthropic_client
    global ollama_client

    # Close existing clients to free resources
    if hasattr(openai_client, 'close'):
        await openai_client.close()
    if hasattr(anthropic_client, 'close'):
        await anthropic_client.close()
    if hasattr(ollama_client, 'close'):
        await ollama_client.close()

    # Create new clients
    openai_client = OpenAILLM()
    anthropic_client = AnthropicLLM()
    ollama_client = OllamaLLM()


async def llm_close_clients():
    """关闭所有 LLM 客户端连接"""
    global openai_client, anthropic_client, ollama_client

    if hasattr(openai_client, 'close'):
        await openai_client.close()
    if hasattr(anthropic_client, 'close'):
        await anthropic_client.close()
    if hasattr(ollama_client, 'close'):
        await ollama_client.close()
