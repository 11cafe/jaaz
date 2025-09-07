import copy
import os
import traceback
import aiofiles
import toml
from typing import Dict, TypedDict, Literal, Optional

# 定义配置文件的类型结构


class ModelConfig(TypedDict, total=False):
    type: Literal["text", "image", "video"]
    is_custom: Optional[bool]
    is_disabled: Optional[bool]


class ProviderConfig(TypedDict, total=False):
    url: str
    api_key: str
    max_tokens: int
    models: Dict[str, ModelConfig]
    is_custom: Optional[bool]


AppConfig = Dict[str, ProviderConfig]


DEFAULT_PROVIDERS_CONFIG: AppConfig = {
    'comfyui': {
        'models': {},
        'url': 'http://127.0.0.1:8188',
        'api_key': '',
    },
    'ollama': {
        'models': {},
        'url': 'http://localhost:11434',
        'api_key': '',
        'max_tokens': 8192,
    },
    'openai': {
        'models': {
            'gpt-4o': {'type': 'text'},
            'gpt-4o-mini': {'type': 'text'},
        },
        'url': 'https://api.tu-zi.com/v1',
        'api_key': 'sk-xNyBtMDiP435GMO6e2opXYiSpkNbcVwMK93Vz8joVIPTXuzV',
        'max_tokens': 8192,
    },
    'google': {
        'models': {
            'gemini-2.5-flash-image': {'type': 'image'},
            'gemini-2.5-pro': {'type': 'text'},
        },
        'url': 'https://api.tu-zi.com/v1',
        'api_key': 'sk-CRJTvndo8xN0nmzTe5fyij77T0tmT7ZMcjLZwMzZ0RmvkOP0',
    },

}

SERVER_DIR = os.path.dirname(os.path.dirname(__file__))
USER_DATA_DIR = os.getenv(
    "USER_DATA_DIR",
    os.path.join(SERVER_DIR, "user_data"),
)
FILES_DIR = os.path.join(USER_DATA_DIR, "files")
USERS_DIR = os.path.join(USER_DATA_DIR, "users")
ANONYMOUS_USER_ID = "anonymous"


IMAGE_FORMATS = (
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",  # 基础格式
    ".bmp",
    ".tiff",
    ".tif",  # 其他常见格式
    ".webp",
)
VIDEO_FORMATS = (
    ".mp4",
    ".avi",
    ".mkv",
    ".mov",
    ".wmv",
    ".flv",
)


class ConfigService:
    def __init__(self):
        self.app_config: AppConfig = copy.deepcopy(DEFAULT_PROVIDERS_CONFIG)
        self.config_file = os.getenv(
            "CONFIG_PATH", os.path.join(USER_DATA_DIR, "config.toml")
        )
        self.initialized = False

    def _get_jaaz_url(self) -> str:
        """Get the correct jaaz URL"""
        return os.getenv('BASE_API_URL', 'https://jaaz.app').rstrip('/') + '/api/v1/'

    async def initialize(self) -> None:
        try:
            # Ensure the user_data directory exists
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)

            # Check if config file exists
            if not self.exists_config():
                print(
                    f"Config file not found at {self.config_file}, creating default configuration")
                # Create default config file
                with open(self.config_file, "w") as f:
                    toml.dump(self.app_config, f)
                print(f"Default config file created at {self.config_file}")
                self.initialized = True
                return

            async with aiofiles.open(self.config_file, "r") as f:
                content = await f.read()
                config: AppConfig = toml.loads(content)
            for provider, provider_config in config.items():
                if provider not in DEFAULT_PROVIDERS_CONFIG:
                    provider_config['is_custom'] = True
                self.app_config[provider] = provider_config
                # image/video models are hardcoded in the default provider config
                provider_models = DEFAULT_PROVIDERS_CONFIG.get(
                    provider, {}).get('models', {})
                for model_name, model_config in provider_config.get('models', {}).items():
                    # Only text model can be self added
                    if model_config.get('type') == 'text' and model_name not in provider_models:
                        provider_models[model_name] = model_config
                        provider_models[model_name]['is_custom'] = True
                self.app_config[provider]['models'] = provider_models

            # 确保 jaaz URL 始终正确
            if 'jaaz' in self.app_config:
                self.app_config['jaaz']['url'] = self._get_jaaz_url()
        except Exception as e:
            print(f"Error loading config: {e}")
            traceback.print_exc()
        finally:
            self.initialized = True

    def get_config(self) -> AppConfig:
        if 'jaaz' in self.app_config:
            self.app_config['jaaz']['url'] = self._get_jaaz_url()
        return self.app_config

    async def update_config(self, data: AppConfig) -> Dict[str, str]:
        try:
            if 'jaaz' in data:
                data['jaaz']['url'] = self._get_jaaz_url()

            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, "w") as f:
                toml.dump(data, f)
            self.app_config = data

            return {
                "status": "success",
                "message": "Configuration updated successfully",
            }
        except Exception as e:
            traceback.print_exc()
            return {"status": "error", "message": str(e)}

    def exists_config(self) -> bool:
        return os.path.exists(self.config_file)


def email_to_directory_name(email: str) -> str:
    """
    将邮箱地址转换为安全的目录名
    
    转换规则：
    - @ → _at_
    - . → _dot_
    - 全部转换为小写
    - 限制最大长度为100字符
    
    例子：
    user@example.com -> user_at_example_dot_com
    Test.User+123@Gmail.Com -> test_dot_user+123_at_gmail_dot_com
    """
    if not email:
        return ANONYMOUS_USER_ID
    
    # 转换为小写
    safe_name = email.lower()
    
    # 替换特殊字符
    safe_name = safe_name.replace('@', '_at_')
    safe_name = safe_name.replace('.', '_dot_')
    
    # 限制长度（留有一些空间给文件系统）
    if len(safe_name) > 100:
        safe_name = safe_name[:100]
    
    # 确保不以点或空格开头/结尾（防止文件系统问题）
    safe_name = safe_name.strip(' .')
    
    # 如果转换后为空，使用匿名用户ID
    if not safe_name:
        return ANONYMOUS_USER_ID
    
    return safe_name


def get_user_files_dir(user_email: Optional[str] = None, user_id: Optional[str] = None) -> str:
    """
    获取用户文件目录路径
    优先使用邮箱，如果没有邮箱则使用用户ID（向后兼容）
    """
    if user_email:
        # 使用邮箱创建目录名
        directory_name = email_to_directory_name(user_email)
    elif user_id:
        # 向后兼容：使用用户ID
        directory_name = user_id
    else:
        # 匿名用户
        directory_name = ANONYMOUS_USER_ID
    
    user_files_dir = os.path.join(USERS_DIR, directory_name, "files")
    os.makedirs(user_files_dir, exist_ok=True)
    return user_files_dir


def get_legacy_files_dir() -> str:
    """获取旧版本文件目录（向后兼容）"""
    return FILES_DIR


config_service = ConfigService()
