import sys
import logging

logging.basicConfig(
    level=logging.INFO,  # 添加日志级别
    format='%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(funcName)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # 明确指定输出到 stdout
    ]
)

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)