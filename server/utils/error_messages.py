"""
多语言错误消息工具
提供友好的用户错误提示信息
"""

from typing import Dict, Optional

class ErrorMessages:
    """多语言错误消息管理器"""
    
    ERROR_MESSAGES = {
        'service_busy': {
            'zh': '🔄 服务繁忙，请稍后重试...',
            'en': '🔄 Service is busy, please try again later...',
            'ja': '🔄 サービスが混雑しています。しばらくしてからもう一度お試しください...',
        },
        'timeout': {
            'zh': '⏰ 处理时间过长，请稍后重试...',
            'en': '⏰ Processing timeout, please try again later...',
            'ja': '⏰ 処理時間が長すぎます。しばらくしてからもう一度お試しください...',
        },
        'generation_failed': {
            'zh': '💭 图片生成失败，请重新尝试...',
            'en': '💭 Image generation failed, please try again...',
            'ja': '💭 画像生成に失敗しました。再度お試しください...',
        },
        'api_error': {
            'zh': '🔧 服务暂时不可用，请稍后重试...',
            'en': '🔧 Service temporarily unavailable, please try again later...',
            'ja': '🔧 サービスが一時的に利用できません。しばらくしてからもう一度お試しください...',
        },
        'upload_failed': {
            'zh': '📤 图片上传失败，请重新尝试...',
            'en': '📤 Image upload failed, please try again...',
            'ja': '📤 画像のアップロードに失敗しました。再度お試しください...',
        },
        'network_error': {
            'zh': '🌐 网络连接异常，请检查网络后重试...',
            'en': '🌐 Network connection error, please check your connection and try again...',
            'ja': '🌐 ネットワーク接続エラーです。接続を確認して再度お試しください...',
        }
    }
    
    @classmethod
    def get_message(cls, error_type: str, language: str = 'zh') -> str:
        """
        获取错误消息
        
        Args:
            error_type: 错误类型
            language: 语言代码 ('zh', 'en', 'ja')
        
        Returns:
            对应语言的错误消息
        """
        if error_type not in cls.ERROR_MESSAGES:
            # 默认错误消息
            return cls.ERROR_MESSAGES['service_busy'].get(language, cls.ERROR_MESSAGES['service_busy']['zh'])
        
        return cls.ERROR_MESSAGES[error_type].get(language, cls.ERROR_MESSAGES[error_type]['zh'])
    
    @classmethod
    def get_timeout_message(cls, language: str = 'zh') -> str:
        """获取超时错误消息"""
        return cls.get_message('timeout', language)
    
    @classmethod
    def get_service_busy_message(cls, language: str = 'zh') -> str:
        """获取服务繁忙消息"""
        return cls.get_message('service_busy', language)
    
    @classmethod
    def get_generation_failed_message(cls, language: str = 'zh') -> str:
        """获取生成失败消息"""
        return cls.get_message('generation_failed', language)
    
    @classmethod
    def get_api_error_message(cls, language: str = 'zh') -> str:
        """获取API错误消息"""
        return cls.get_message('api_error', language)
    
    @classmethod
    def classify_error(cls, error_str: str) -> str:
        """
        根据错误字符串分类错误类型
        
        Args:
            error_str: 错误信息字符串
        
        Returns:
            错误类型
        """
        error_lower = error_str.lower()
        
        if any(keyword in error_lower for keyword in ['timeout', 'timed out', '超时']):
            return 'timeout'
        elif any(keyword in error_lower for keyword in ['busy', 'rate limit', '繁忙', 'too many requests']):
            return 'service_busy'
        elif any(keyword in error_lower for keyword in ['network', 'connection', '网络', '连接']):
            return 'network_error'
        elif any(keyword in error_lower for keyword in ['upload', '上传']):
            return 'upload_failed'
        elif any(keyword in error_lower for keyword in ['generation', 'generate', '生成']):
            return 'generation_failed'
        else:
            return 'api_error'

def get_user_friendly_error(error_str: str, language: str = 'zh') -> str:
    """
    将技术错误转换为用户友好的错误消息
    
    Args:
        error_str: 原始错误信息
        language: 目标语言
    
    Returns:
        用户友好的错误消息
    """
    error_type = ErrorMessages.classify_error(error_str)
    return ErrorMessages.get_message(error_type, language)