from typing import Optional
from qcloud_cos import CosConfig
from qcloud_cos import CosS3Client
import sys
import os
import dotenv

dotenv.load_dotenv()

class CosUtils:
    """
    腾讯云存储工具
    """
    def __init__(self) -> None:
        secret_id = os.getenv('COS_SECRET_ID')    # 替换为用户的 SecretId
        secret_key = os.getenv('COS_SECRET_KEY')    # 替换为用户的 SecretKey
        self.region = os.getenv('COS_REGION')              # 替换为用户的 region，例如 ap-beijing
        token = None                      # 如果使用永久密钥不需要填入token，如果使用临时密钥需要填入
        # 2. 获取配置对象
        config = CosConfig(Region=self.region, SecretId=secret_id, SecretKey=secret_key, Token=token)
        # 3. 获取客户端对象
        self.client = CosS3Client(config)
        # 存储桶名称
        self.bucket_name = 'magicart-user-1301698982'  # 替换为你的存储桶名称

    def upload_file(self, file_path: str, file_type: str, key: str) -> Optional[str]:
        """
        上传文件到腾讯云COS
        """
        try:
            with open(file_path, 'rb') as fp:
                response = self.client.put_object(
                              Bucket=self.bucket_name,
                              Body=fp,
                              Key=key,
                              EnableMD5=False,
                              StorageClass='STANDARD',
                              ContentType=f'image/{file_type}'  # 根据图片类型设置
                            )
            url = f"https://{self.bucket_name}.cos.{self.region}.myqcloud.com/{key}"
            return url
        except Exception as e:
            sys.stderr.write(f"上传文件失败: {e}\n")
            return None

    def upload_image_from_bytes(self, image_bytes: bytes, cos_file_path: str, content_type: str = 'image/png') -> Optional[str]:
        """
        上传字节数据
    
        Args:
            image_bytes: 图片的字节数据
            cos_file_path: COS上的文件路径
            content_type: 文件类型
        """
        try:
            response = self.client.put_object(
                Bucket=self.bucket_name,
                Body=image_bytes,
                Key=cos_file_path,
                ContentType=content_type
            )
            url = f"https://{self.bucket_name}.cos.{self.region}.myqcloud.com/{cos_file_path}"
            return url
        except Exception as e:
            sys.stderr.write(f"上传失败: {e}\n")
            return None
        
    def get_file_url(self, key: str) -> Optional[str]:
        """
        获取文件URL
        """
        url = f"https://{self.bucket_name}.cos.{self.region}.myqcloud.com/{key}"
        return url
        
if __name__  == "__main__":
    cos = CosUtils()
    print(cos.upload_file("./test.png", "png", "test"))