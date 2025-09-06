import os

DEFAULT_PORT = int(os.environ.get('DEFAULT_PORT', 8000))

# 自动检测环境并设置合适的协议
def get_base_url():
    """获取基础URL，自动检测环境并设置合适的协议"""
    base_url = os.environ.get('BASE_URL')
    if base_url:
        return base_url
    
    # 检测是否在生产环境（通过常见的环境变量判断）
    is_production = (
        os.environ.get('NODE_ENV') == 'production' or
        os.environ.get('ENVIRONMENT') == 'production' or
        os.environ.get('ENV') == 'production' or
        'magicart.cc' in os.environ.get('HOST', '') or
        'magicart.cc' in os.environ.get('HOSTNAME', '')
    )
    
    if is_production:
        return 'https://www.magicart.cc'
    else:
        return f'http://localhost:{DEFAULT_PORT}'

BASE_URL = get_base_url()
