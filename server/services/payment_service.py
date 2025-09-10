import os
import httpx
from typing import Dict, Any, Optional
from log import get_logger

logger = get_logger(__name__)

class CreemPaymentService:
    def __init__(self):
        # Creem API配置
        self.api_base_url = "https://test-api.creem.io/v1"
        self.api_key = os.getenv("CREEM_API_KEY", "creem_test_7emlTUWBmWR007A0ODUAnU")  # 测试环境API Key
        # self.return_url = os.getenv("CREEM_RETURN_URL", "http://localhost:8000/payments")
        
        self.headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json"
        }
    
    async def create_checkout(self, product_id: str, customer_email: str = None) -> Dict[str, Any]:
        """
        创建Creem支付链接
        
        Args:
            product_id: Creem产品ID
            customer_email: 客户邮箱（可选）
        
        Returns:
            Dict包含checkout_url和checkout_id等信息
        """
        try:
            url = f"{self.api_base_url}/checkouts"
            
            payload = {
                "product_id": product_id,
                # "return_url": self.return_url
            }
            
            # 如果提供了客户邮箱，添加到请求中
            # if customer_email:
            #     payload["customer_email"] = customer_email
            
            logger.info(f"Creating Creem checkout for product: {product_id}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, 
                    json=payload, 
                    headers=self.headers,
                    timeout=30.0
                )
                
                if response.status_code == 200 or response.status_code == 201:
                    result = response.json()
                    logger.info(f"Creem checkout created successfully: {result.get('id', 'unknown')}")
                    return {
                        "success": True,
                        "data": result
                    }
                else:
                    logger.error(f"Creem API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"Creem API error: {response.status_code}",
                        "details": response.text
                    }
                    
        except httpx.TimeoutException:
            logger.error("Creem API timeout")
            return {
                "success": False,
                "error": "Payment service timeout"
            }
        except Exception as e:
            logger.error(f"Error creating Creem checkout: {e}")
            return {
                "success": False,
                "error": f"Payment service error: {str(e)}"
            }
    
    def verify_callback_signature(self, query_params: Dict[str, Any], expected_signature: str = None) -> bool:
        """
        验证Creem回调签名（简化版本）
        在生产环境中，应该根据Creem文档实现真正的签名验证
        
        Args:
            query_params: 回调查询参数
            expected_signature: 期望的签名
        
        Returns:
            bool: 签名是否有效
        """
        # 简化验证：检查必要字段是否存在
        required_fields = ['checkout_id', 'order_id', 'product_id']
        
        for field in required_fields:
            if field not in query_params:
                logger.warning(f"Missing required field in callback: {field}")
                return False
        
        # 在生产环境中，这里应该实现真正的HMAC签名验证
        # signature = query_params.get('signature')
        # if not signature:
        #     return False
        
        logger.info("Callback signature verification passed (simplified)")
        return True
    
    def parse_callback_params(self, query_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        解析Creem回调参数
        
        Args:
            query_params: URL查询参数
        
        Returns:
            解析后的回调数据，如果解析失败返回None
        """
        try:
            # 提取关键信息
            callback_data = {
                'checkout_id': query_params.get('checkout_id'),
                'order_id': query_params.get('order_id'),
                'customer_id': query_params.get('customer_id'),
                'subscription_id': query_params.get('subscription_id'),
                'product_id': query_params.get('product_id'),
                'signature': query_params.get('signature')
            }
            
            # 验证必要字段
            if not all([callback_data['checkout_id'], callback_data['order_id'], callback_data['product_id']]):
                logger.error("Missing required callback parameters")
                return None
            
            logger.info(f"Parsed callback for order: {callback_data['order_id']}")
            return callback_data
            
        except Exception as e:
            logger.error(f"Error parsing callback parameters: {e}")
            return None
    
    async def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """
        取消Creem订阅
        
        Args:
            subscription_id: Creem订阅ID
        
        Returns:
            Dict包含取消结果信息
        """
        try:
            url = f"{self.api_base_url}/subscriptions/{subscription_id}/cancel"
            
            logger.info(f"Cancelling Creem subscription: {subscription_id}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url, 
                    headers=self.headers,
                    timeout=30.0
                )
                
                if response.status_code == 200 or response.status_code == 201:
                    result = response.json()
                    
                    # 验证返回的ID是否一致
                    returned_id = result.get('id')
                    if returned_id != subscription_id:
                        logger.error(f"Subscription ID mismatch: requested {subscription_id}, returned {returned_id}")
                        return {
                            "success": False,
                            "error": "Subscription ID mismatch in response"
                        }
                    
                    # 验证状态是否为cancelled
                    status = result.get('status')
                    if status != 'canceled':
                        logger.error(f"Subscription cancellation failed: status is {status}, expected 'canceled'")
                        return {
                            "success": False,
                            "error": f"Cancellation failed: status is {status}"
                        }
                    
                    logger.info(f"Subscription {subscription_id} cancelled successfully")
                    return {
                        "success": True,
                        "data": result,
                        "subscription_id": returned_id,
                        "status": status
                    }
                else:
                    # 检查是否是"已经取消"的错误
                    if response.status_code == 400:
                        try:
                            error_data = response.json()
                            if "already canceled" in error_data.get("message", "").lower():
                                logger.info(f"Subscription {subscription_id} was already cancelled")
                                return {
                                    "success": True,
                                    "data": {"id": subscription_id, "status": "canceled"},
                                    "subscription_id": subscription_id,
                                    "status": "canceled",
                                    "message": "Subscription was already cancelled"
                                }
                        except:
                            pass
                    
                    logger.error(f"Creem cancel subscription API error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"Creem API error: {response.status_code}",
                        "details": response.text
                    }
                    
        except httpx.TimeoutException:
            logger.error("Creem cancel subscription API timeout")
            return {
                "success": False,
                "error": "Payment service timeout"
            }
        except Exception as e:
            logger.error(f"Error cancelling Creem subscription: {e}")
            return {
                "success": False,
                "error": f"Payment service error: {str(e)}"
            }

# 创建单例实例
payment_service = CreemPaymentService()