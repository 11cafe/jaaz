"""
国际化服务
提供多语言消息支持
"""

from typing import Dict, Optional
import re

class I18nService:
    """国际化服务类"""
    
    # 积分不足消息
    INSUFFICIENT_POINTS_MESSAGES = {
        'zh': "抱歉，您的账户余额不足，无法进行图片生成。当前积分：{current}，需要积分：{required}。请前往订阅页面充值积分以继续使用画图功能。",
        'zh-CN': "抱歉，您的账户余额不足，无法进行图片生成。当前积分：{current}，需要积分：{required}。请前往订阅页面充值积分以继续使用画图功能。",
        'en': "Sorry, your account balance is insufficient for image generation. Current credits: {current}, required: {required}. Please visit the subscription page to purchase more credits.",
        'en-US': "Sorry, your account balance is insufficient for image generation. Current credits: {current}, required: {required}. Please visit the subscription page to purchase more credits."
    }
    
    # 简化版本（不显示具体积分数）
    INSUFFICIENT_POINTS_SIMPLE_MESSAGES = {
        'zh': "抱歉，您的账户余额不足，无法进行图片生成。请前往订阅页面充值积分以继续使用画图功能。",
        'zh-CN': "抱歉，您的账户余额不足，无法进行图片生成。请前往订阅页面充值积分以继续使用画图功能。",
        'en': "Sorry, your account balance is insufficient for image generation. Please visit the subscription page to purchase more credits.",
        'en-US': "Sorry, your account balance is insufficient for image generation. Please visit the subscription page to purchase more credits."
    }
    
    # 🆕 图片生成成功消息
    IMAGE_GENERATED_MESSAGES = {
        'zh': "🎨 图片已生成并添加到画布",
        'zh-CN': "🎨 图片已生成并添加到画布", 
        'en': "🎨 Image generated and added to canvas",
        'en-US': "🎨 Image generated and added to canvas"
    }
    
    # 🆕 视频生成成功消息
    VIDEO_GENERATED_MESSAGES = {
        'zh': "🎬 视频已生成并添加到画布",
        'zh-CN': "🎬 视频已生成并添加到画布",
        'en': "🎬 Video generated and added to canvas", 
        'en-US': "🎬 Video generated and added to canvas"
    }
    
    # 🆕 多张图片生成成功消息
    MULTIPLE_IMAGES_GENERATED_MESSAGES = {
        'zh': "🎨 {service}已生成 {count} 张图片并添加到画布",
        'zh-CN': "🎨 {service}已生成 {count} 张图片并添加到画布",
        'en': "🎨 {service} generated {count} images and added to canvas",
        'en-US': "🎨 {service} generated {count} images and added to canvas"
    }
    
    # 🆕 多个文件生成成功消息
    MULTIPLE_FILES_GENERATED_MESSAGES = {
        'zh': "🔧 {service}工作流执行成功，已生成 {count} 个文件并添加到画布",
        'zh-CN': "🔧 {service}工作流执行成功，已生成 {count} 个文件并添加到画布",
        'en': "🔧 {service} workflow executed successfully, generated {count} files and added to canvas",
        'en-US': "🔧 {service} workflow executed successfully, generated {count} files and added to canvas"
    }
    
    @staticmethod
    def detect_language_from_accept_header(accept_language: Optional[str]) -> str:
        """
        从Accept-Language头部检测用户语言偏好
        
        Args:
            accept_language: HTTP Accept-Language 头部值
            
        Returns:
            语言代码，默认为'en'
        """
        if not accept_language:
            return 'en'
        
        # 解析Accept-Language头部
        # 格式示例: "zh-CN,zh;q=0.9,en;q=0.8"
        languages = []
        for lang in accept_language.split(','):
            parts = lang.strip().split(';')
            language = parts[0].strip()
            
            # 提取权重
            weight = 1.0
            if len(parts) > 1:
                weight_part = parts[1].strip()
                if weight_part.startswith('q='):
                    try:
                        weight = float(weight_part[2:])
                    except ValueError:
                        weight = 1.0
            
            languages.append((language, weight))
        
        # 按权重排序
        languages.sort(key=lambda x: x[1], reverse=True)
        
        # 优先查找完全匹配
        for lang, _ in languages:
            if lang.lower() in I18nService.INSUFFICIENT_POINTS_MESSAGES:
                return lang.lower()
        
        # 查找语言族匹配
        for lang, _ in languages:
            lang_family = lang.split('-')[0].lower()
            if lang_family in I18nService.INSUFFICIENT_POINTS_MESSAGES:
                return lang_family
        
        # 特殊处理中文
        for lang, _ in languages:
            if lang.lower().startswith('zh'):
                return 'zh-CN'
        
        # 默认返回英文
        return 'en'
    
    @staticmethod
    def get_insufficient_points_message(
        language: str = 'en',
        current_points: Optional[int] = None,
        required_points: Optional[int] = None,
        show_details: bool = True
    ) -> str:
        """
        获取积分不足的本地化消息
        
        Args:
            language: 语言代码
            current_points: 当前积分数
            required_points: 需要的积分数
            show_details: 是否显示具体积分数量
            
        Returns:
            本地化的消息文本
        """
        # 规范化语言代码
        lang = language.lower()
        
        # 选择消息模板
        if show_details and current_points is not None and required_points is not None:
            messages = I18nService.INSUFFICIENT_POINTS_MESSAGES
        else:
            messages = I18nService.INSUFFICIENT_POINTS_SIMPLE_MESSAGES
        
        # 查找完全匹配的语言
        if lang in messages:
            template = messages[lang]
        else:
            # 查找语言族匹配
            lang_family = lang.split('-')[0]
            if lang_family in messages:
                template = messages[lang_family]
            else:
                # 默认使用英文
                template = messages['en']
        
        # 格式化消息
        if show_details and current_points is not None and required_points is not None:
            return template.format(current=current_points, required=required_points)
        else:
            return template
    
    @staticmethod
    def detect_language_from_content(content: str) -> str:
        """
        从文本内容检测语言（简单的启发式方法）
        
        Args:
            content: 文本内容
            
        Returns:
            推测的语言代码
        """
        # 统计中文字符数量
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content))
        total_chars = len(content.replace(' ', ''))
        
        # 如果中文字符占比超过30%，认为是中文
        if total_chars > 0 and chinese_chars / total_chars > 0.3:
            return 'zh-CN'
        
        return 'en'
    
    @staticmethod
    def get_message(message_dict: Dict[str, str], language: str = 'en', **kwargs) -> str:
        """
        获取本地化消息的通用方法
        
        Args:
            message_dict: 消息字典
            language: 语言代码
            **kwargs: 格式化参数
            
        Returns:
            本地化的消息文本
        """
        # 规范化语言代码
        lang = language.lower()
        
        # 查找完全匹配的语言
        if lang in message_dict:
            template = message_dict[lang]
        else:
            # 查找语言族匹配
            lang_family = lang.split('-')[0]
            if lang_family in message_dict:
                template = message_dict[lang_family]
            else:
                # 默认使用英文
                template = message_dict.get('en', list(message_dict.values())[0])
        
        # 格式化消息
        try:
            return template.format(**kwargs)
        except KeyError:
            # 如果格式化失败，返回原始模板
            return template
    
    @staticmethod
    def get_image_generated_message(language: str = 'en') -> str:
        """获取图片生成成功的本地化消息"""
        return I18nService.get_message(I18nService.IMAGE_GENERATED_MESSAGES, language)
    
    @staticmethod
    def get_video_generated_message(language: str = 'en') -> str:
        """获取视频生成成功的本地化消息"""
        return I18nService.get_message(I18nService.VIDEO_GENERATED_MESSAGES, language)
    
    @staticmethod
    def get_multiple_images_generated_message(service: str, count: int, language: str = 'en') -> str:
        """获取多张图片生成成功的本地化消息"""
        return I18nService.get_message(
            I18nService.MULTIPLE_IMAGES_GENERATED_MESSAGES, 
            language, 
            service=service, 
            count=count
        )
    
    @staticmethod
    def get_multiple_files_generated_message(service: str, count: int, language: str = 'en') -> str:
        """获取多个文件生成成功的本地化消息"""
        return I18nService.get_message(
            I18nService.MULTIPLE_FILES_GENERATED_MESSAGES, 
            language, 
            service=service, 
            count=count
        )

# 创建全局实例
i18n_service = I18nService()