from fastapi import APIRouter, HTTPException, Request, Depends
from typing import Optional, List
from pydantic import BaseModel

from services.db_service import db_service
from services.payment_service import payment_service
from routers.auth_router import verify_access_token
from log import get_logger

logger = get_logger(__name__)

router = APIRouter()

class BalanceResponse(BaseModel):
    balance: str

class CreateOrderRequest(BaseModel):
    plan_type: str  # base, pro, max
    billing_period: str  # monthly, yearly

class CreateOrderResponse(BaseModel):
    success: bool
    checkout_url: Optional[str] = None
    order_id: Optional[int] = None
    message: Optional[str] = None

class Product(BaseModel):
    id: int
    product_id: str
    name: str
    level: str
    points: int
    price_cents: int
    description: str

class ProductListResponse(BaseModel):
    products: List[Product]

def get_current_user(request: Request) -> Optional[dict]:
    """从请求头中获取当前用户信息"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    user_payload = verify_access_token(token)
    return user_payload

@router.get("/api/billing/getBalance", response_model=BalanceResponse)
async def get_balance(request: Request):
    """获取用户积分余额"""
    # 验证用户认证
    user_payload = get_current_user(request)
    if not user_payload:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user_payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user_id")
    
    try:
        # 从数据库获取用户信息
        user = await db_service.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # 将积分转换为金额格式（积分除以100）
        points = user.get("points", 0)
        balance_amount = points / 100.0
        
        logger.info(f"User {user_id} balance request: {points} points = ${balance_amount:.2f}")
        
        return BalanceResponse(balance=f"{balance_amount:.2f}")
        
    except Exception as e:
        logger.error(f"Error getting balance for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/api/billing/products", response_model=ProductListResponse)
async def get_products():
    """获取所有可用的产品列表"""
    try:
        products = await db_service.list_products()
        return ProductListResponse(products=products)
    except Exception as e:
        logger.error(f"Error getting products: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/api/billing/create_order", response_model=CreateOrderResponse)
async def create_order(request: Request, order_data: CreateOrderRequest):
    """创建支付订单"""
    # 验证用户认证
    user_payload = get_current_user(request)
    if not user_payload:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user_payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing user_id")
    
    try:
        # 获取用户信息
        user = await db_service.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_uuid = user.get("uuid")
        user_email = user.get("email")
        
        # 构建产品ID - 对于base计划使用真实的测试product_id
        if order_data.plan_type == "base" and order_data.billing_period == "monthly":
            product_id = "prod_QT1QHgJmtigUHce5HToDW"  # 测试环境的真实base产品ID
        else:
            product_id = f"prod_{order_data.plan_type}_{order_data.billing_period}"
        
        # 验证产品是否存在
        product = await db_service.get_product_by_id(product_id)
        if not product:
            raise HTTPException(status_code=400, detail=f"Invalid product: {product_id}")
        
        # 创建本地订单记录
        order_id = await db_service.create_order(
            user_uuid=user_uuid, 
            product_id=product_id, 
            price_cents=product['price_cents']
        )
        
        if not order_id:
            raise HTTPException(status_code=500, detail="Failed to create order")
        
        # 调用Creem API创建支付链接
        creem_result = await payment_service.create_checkout(
            product_id=product_id,
            customer_email=user_email
        )
        
        if not creem_result.get("success"):
            logger.error(f"Creem checkout creation failed: {creem_result}")
            return CreateOrderResponse(
                success=False,
                message=f"Payment service error: {creem_result.get('error', 'Unknown error')}"
            )
        
        # 更新订单记录，保存Creem相关信息
        creem_data = creem_result.get("data", {})
        checkout_id = creem_data.get("id")
        checkout_url = creem_data.get("url")
        
        if checkout_id:
            await db_service.update_order_creem_info(
                order_id=order_id,
                creem_checkout_id=checkout_id
            )
        
        logger.info(f"Order created successfully: {order_id}, checkout_id: {checkout_id}")
        
        return CreateOrderResponse(
            success=True,
            checkout_url=checkout_url,
            order_id=order_id,
            message="Payment link created successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating order for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/payments")
async def handle_payment_callback(request: Request):
    """处理Creem支付成功回调"""
    try:
        # 获取查询参数
        query_params = dict(request.query_params)
        logger.info(f"Received payment callback: {query_params}")
        
        # 解析回调参数
        callback_data = payment_service.parse_callback_params(query_params)
        if not callback_data:
            logger.error("Invalid callback parameters")
            raise HTTPException(status_code=400, detail="Invalid callback parameters")
        
        # 验证回调签名（简化版本）
        if not payment_service.verify_callback_signature(query_params):
            logger.error("Invalid callback signature")
            raise HTTPException(status_code=400, detail="Invalid signature")
        
        # 获取相关信息
        creem_order_id = callback_data['order_id']
        product_id = callback_data['product_id']
        checkout_id = callback_data['checkout_id']
        subscription_id = callback_data.get('subscription_id')
        
        # 查找本地订单 - 优先使用order_id，如果没有则使用checkout_id
        order = None
        if creem_order_id:
            order = await db_service.get_order_by_creem_order_id(creem_order_id)
        
        if not order and checkout_id:
            order = await db_service.get_order_by_checkout_id(checkout_id)
            logger.info(f"Found order by checkout_id: {checkout_id}")
        
        if not order:
            logger.error(f"Order not found for Creem order ID: {creem_order_id} or checkout ID: {checkout_id}")
            raise HTTPException(status_code=404, detail="Order not found")
        
        # 检查订单是否已经处理过
        if order['status'] == 'completed':
            logger.info(f"Order {order['id']} already completed")
            return {"status": "success", "message": "Order already processed"}
        
        # 更新订单的Creem信息
        await db_service.update_order_creem_info(
            order_id=order['id'],
            creem_order_id=creem_order_id,
            creem_checkout_id=checkout_id,
            creem_subscription_id=subscription_id
        )
        
        # 获取产品信息（积分数量）
        product = await db_service.get_product_by_id(product_id)
        if not product:
            logger.error(f"Product not found: {product_id}")
            raise HTTPException(status_code=400, detail="Product not found")
        
        points_to_add = product['points']
        user_uuid = order['user_uuid']
        
        # 为用户增加积分
        success = await db_service.add_user_points(user_uuid, points_to_add)
        if not success:
            logger.error(f"Failed to add points to user {user_uuid}")
            raise HTTPException(status_code=500, detail="Failed to update user points")
        
        # 更新用户等级
        user = await db_service.get_user_by_uuid(user_uuid)
        if user and user['level'] != product['level']:
            await db_service.update_user_level(user['id'], product['level'])
            logger.info(f"Updated user {user_uuid} level to {product['level']}")
        
        # 完成订单
        await db_service.complete_order(order['id'], points_to_add)
        
        logger.info(f"Payment processed successfully: order {order['id']}, user {user_uuid}, points {points_to_add}")
        
        # 支付成功后重定向回前端页面
        from fastapi.responses import RedirectResponse
        from routers.auth_router import get_redirect_uri
        
        # 动态获取正确的前端URI
        frontend_uri = get_redirect_uri(request)
        
        # 构建成功页面URL，包含支付结果信息
        success_url = f"{frontend_uri}/?payment=success&points={points_to_add}&level={product['level']}&order_id={order['id']}"
        
        logger.info(f"Redirecting to success page: {success_url}")
        
        # 创建重定向响应，确保保持认证状态
        response = RedirectResponse(url=success_url, status_code=302)
        
        # 🔧 重要：确保认证cookie在重定向时得到正确设置
        # 检测是否是跨端口重定向，如果是则需要特殊处理
        request_host = request.headers.get("host", "")
        redirect_host = frontend_uri.split("://")[1] if "://" in frontend_uri else frontend_uri
        
        if request_host != redirect_host:
            logger.info(f"Cross-port redirect detected: {request_host} -> {redirect_host}")
            
            # 获取现有的认证cookie
            auth_token = request.cookies.get("auth_token")
            user_uuid = request.cookies.get("user_uuid")
            user_email = request.cookies.get("user_email")
            
            if auth_token and user_uuid:
                # 重新设置cookie，确保在目标域名/端口生效
                is_secure = frontend_uri.startswith("https://")
                is_localhost = "localhost" in frontend_uri or "127.0.0.1" in frontend_uri
                
                cookie_kwargs = {
                    "max_age": 30 * 24 * 60 * 60,  # 30天
                    "secure": is_secure and not is_localhost,
                    "samesite": "lax",
                    "path": "/"
                }
                
                # 在localhost环境下，不设置domain让cookie对所有端口生效
                if not is_localhost:
                    import urllib.parse as urlparse
                    cookie_kwargs["domain"] = urlparse.urlparse(frontend_uri).hostname
                
                response.set_cookie("auth_token", auth_token, **cookie_kwargs)
                response.set_cookie("user_uuid", user_uuid, **cookie_kwargs)
                if user_email:
                    response.set_cookie("user_email", user_email, **cookie_kwargs)
                
                logger.info("✅ Auth cookies re-set for cross-port redirect")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing payment callback: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")