import sqlite3
import aiosqlite
from typing import List, Dict, Any, Optional
from .config_service import USER_DATA_DIR
from log import get_logger
import os

logger = get_logger(__name__)

DB_PATH = os.path.join(USER_DATA_DIR, "localmanus.db")

class InsufficientPointsError(Exception):
    """积分不足异常"""
    def __init__(self, current_points: int, required_points: int, message: str = None):
        self.current_points = current_points
        self.required_points = required_points
        self.message = message or f"积分不足，当前积分: {current_points}，需要积分: {required_points}"
        super().__init__(self.message)

class PointsService:
    """积分系统服务类"""
    
    def __init__(self):
        self.db_path = DB_PATH
    
    async def add_points(self, user_id: int, user_uuid: str, points: int, 
                        transaction_type: str, description: str, 
                        reference_id: str = None) -> bool:
        """
        给用户增加积分并记录交易
        
        Args:
            user_id: 用户ID
            user_uuid: 用户UUID
            points: 积分数量（正数为增加，负数为扣除）
            transaction_type: 交易类型 ('earn_invite', 'earn_register', 'spend', 'admin_adjust')
            description: 交易描述
            reference_id: 关联ID（如邀请记录ID）
        
        Returns:
            bool: 是否操作成功
        """
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 开始事务
                await db.execute("BEGIN TRANSACTION")
                
                # 获取当前用户积分
                cursor = await db.execute(
                    "SELECT points FROM tb_user WHERE id = ? AND uuid = ?", 
                    (user_id, user_uuid)
                )
                row = await cursor.fetchone()
                
                if not row:
                    logger.error(f"User not found: {user_id}, {user_uuid}")
                    await db.execute("ROLLBACK")
                    return False
                
                current_points = row[0]
                new_balance = current_points + points
                
                # 确保积分不会变成负数
                if new_balance < 0:
                    logger.warning(f"Insufficient points for user {user_id}: current={current_points}, trying to deduct={abs(points)}")
                    await db.execute("ROLLBACK")
                    return False
                
                # 更新用户积分
                await db.execute("""
                    UPDATE tb_user 
                    SET points = ?, mtime = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = ? AND uuid = ?
                """, (new_balance, user_id, user_uuid))
                
                # 记录积分交易
                await db.execute("""
                    INSERT INTO tb_point_transactions 
                    (user_id, user_uuid, points, type, description, reference_id, balance_after)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (user_id, user_uuid, points, transaction_type, description, reference_id, new_balance))
                
                # 提交事务
                await db.execute("COMMIT")
                
                logger.info(f"Points updated for user {user_id}: {current_points} + {points} = {new_balance}")
                return True
                
        except Exception as e:
            logger.error(f"Error adding points for user {user_id}: {e}")
            return False
    
    async def get_user_points_balance(self, user_uuid: str) -> int:
        """获取用户当前积分余额"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                cursor = await db.execute(
                    "SELECT points FROM tb_user WHERE uuid = ?", 
                    (user_uuid,)
                )
                row = await cursor.fetchone()
                return row[0] if row else 0
        except Exception as e:
            logger.error(f"Error getting points balance for user {user_uuid}: {e}")
            return 0
    
    async def get_points_history(self, user_uuid: str, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """获取用户积分交易历史"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                cursor = await db.execute("""
                    SELECT id, points, type, description, reference_id, balance_after, created_at
                    FROM tb_point_transactions
                    WHERE user_uuid = ?
                    ORDER BY created_at DESC
                    LIMIT ? OFFSET ?
                """, (user_uuid, limit, offset))
                
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Error getting points history for user {user_uuid}: {e}")
            return []
    
    async def get_points_stats(self, user_uuid: str) -> Dict[str, Any]:
        """获取用户积分统计信息"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                db.row_factory = sqlite3.Row
                
                # 获取当前余额
                cursor = await db.execute(
                    "SELECT points FROM tb_user WHERE uuid = ?", 
                    (user_uuid,)
                )
                balance_row = await cursor.fetchone()
                current_balance = balance_row[0] if balance_row else 0
                
                # 获取各类型积分统计
                cursor = await db.execute("""
                    SELECT 
                        type,
                        COUNT(*) as transaction_count,
                        SUM(CASE WHEN points > 0 THEN points ELSE 0 END) as total_earned,
                        SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END) as total_spent
                    FROM tb_point_transactions
                    WHERE user_uuid = ?
                    GROUP BY type
                """, (user_uuid,))
                
                type_stats = {}
                total_earned = 0
                total_spent = 0
                
                async for row in cursor:
                    row_dict = dict(row)
                    type_stats[row_dict['type']] = {
                        'count': row_dict['transaction_count'],
                        'earned': row_dict['total_earned'],
                        'spent': row_dict['total_spent']
                    }
                    total_earned += row_dict['total_earned']
                    total_spent += row_dict['total_spent']
                
                return {
                    'current_balance': current_balance,
                    'total_earned': total_earned,
                    'total_spent': total_spent,
                    'net_points': total_earned - total_spent,
                    'by_type': type_stats
                }
                
        except Exception as e:
            logger.error(f"Error getting points stats for user {user_uuid}: {e}")
            return {
                'current_balance': 0,
                'total_earned': 0,
                'total_spent': 0,
                'net_points': 0,
                'by_type': {}
            }
    
    async def validate_points_consistency(self, user_uuid: str) -> Dict[str, Any]:
        """验证用户积分数据一致性"""
        try:
            async with aiosqlite.connect(self.db_path) as db:
                # 获取用户表中的积分
                cursor = await db.execute(
                    "SELECT points FROM tb_user WHERE uuid = ?", 
                    (user_uuid,)
                )
                user_points = (await cursor.fetchone())[0]
                
                # 计算所有交易记录的净积分
                cursor = await db.execute("""
                    SELECT SUM(points) as net_points
                    FROM tb_point_transactions
                    WHERE user_uuid = ?
                """, (user_uuid,))
                
                net_from_transactions = (await cursor.fetchone())[0] or 0
                
                # 获取最后一次交易的balance_after
                cursor = await db.execute("""
                    SELECT balance_after
                    FROM tb_point_transactions
                    WHERE user_uuid = ?
                    ORDER BY created_at DESC
                    LIMIT 1
                """, (user_uuid,))
                
                last_balance = await cursor.fetchone()
                last_transaction_balance = last_balance[0] if last_balance else 0
                
                is_consistent = (user_points == last_transaction_balance)
                
                return {
                    'is_consistent': is_consistent,
                    'user_table_points': user_points,
                    'net_from_transactions': net_from_transactions,
                    'last_transaction_balance': last_transaction_balance,
                    'difference': user_points - last_transaction_balance if last_balance else user_points
                }
                
        except Exception as e:
            logger.error(f"Error validating points consistency for user {user_uuid}: {e}")
            return {
                'is_consistent': False,
                'error': str(e)
            }

    # ===== 画图积分管理专用方法 =====
    
    async def check_image_generation_points(self, user_id: int, user_uuid: str, required_points: int = 2) -> Dict[str, Any]:
        """
        检查用户是否有足够积分进行画图
        
        Args:
            user_id: 用户ID
            user_uuid: 用户UUID
            required_points: 需要的积分数量，默认2分
            
        Returns:
            Dict[str, Any]: {
                'can_generate': bool,        # 是否可以画图
                'current_points': int,       # 当前积分
                'required_points': int,      # 需要积分
                'message': str              # 提示信息
            }
        """
        try:
            current_points = await self.get_user_points_balance(user_uuid)
            
            can_generate = current_points >= required_points
            
            if can_generate:
                message = f"积分充足，当前积分: {current_points}"
            else:
                message = f"积分不足，当前积分: {current_points}，需要积分: {required_points}"
            
            return {
                'can_generate': can_generate,
                'current_points': current_points,
                'required_points': required_points,
                'message': message
            }
            
        except Exception as e:
            logger.error(f"Error checking image generation points for user {user_id}: {e}")
            return {
                'can_generate': False,
                'current_points': 0,
                'required_points': required_points,
                'message': f"检查积分时发生错误: {str(e)}"
            }
    
    async def deduct_image_generation_points(self, user_id: int, user_uuid: str, 
                                           session_id: str = None, 
                                           deduction_points: int = 2) -> Dict[str, Any]:
        """
        扣除画图消耗的积分
        
        Args:
            user_id: 用户ID
            user_uuid: 用户UUID
            session_id: 会话ID，用于记录
            deduction_points: 扣除的积分数量，默认2分
            
        Returns:
            Dict[str, Any]: {
                'success': bool,            # 是否扣除成功
                'points_deducted': int,     # 扣除的积分
                'balance_after': int,       # 扣除后的余额
                'message': str             # 操作信息
            }
        """
        try:
            # 构造交易描述
            description = f"画图生成消耗积分"
            if session_id:
                description += f" (会话: {session_id})"
            
            # 使用负数表示扣除
            success = await self.add_points(
                user_id=user_id,
                user_uuid=user_uuid,
                points=-deduction_points,
                transaction_type='spend',
                description=description,
                reference_id=session_id
            )
            
            if success:
                # 获取扣除后的余额
                balance_after = await self.get_user_points_balance(user_uuid)
                message = f"成功扣除 {deduction_points} 积分，剩余积分: {balance_after}"
                
                logger.info(f"Image generation points deducted: user={user_id}, points={deduction_points}, balance={balance_after}")
                
                return {
                    'success': True,
                    'points_deducted': deduction_points,
                    'balance_after': balance_after,
                    'message': message
                }
            else:
                return {
                    'success': False,
                    'points_deducted': 0,
                    'balance_after': 0,
                    'message': f"扣除积分失败，可能是积分不足"
                }
                
        except Exception as e:
            logger.error(f"Error deducting image generation points for user {user_id}: {e}")
            return {
                'success': False,
                'points_deducted': 0,
                'balance_after': 0,
                'message': f"扣除积分时发生错误: {str(e)}"
            }
    
    async def check_and_reserve_image_generation_points(self, user_id: int, user_uuid: str, 
                                                      required_points: int = 2) -> None:
        """
        检查并预留画图积分，如果积分不足则抛出异常
        这个方法专门用于画图前的积分检查
        
        Args:
            user_id: 用户ID
            user_uuid: 用户UUID
            required_points: 需要的积分数量，默认2分
            
        Raises:
            InsufficientPointsError: 积分不足时抛出异常
        """
        try:
            current_points = await self.get_user_points_balance(user_uuid)
            
            if current_points < required_points:
                raise InsufficientPointsError(
                    current_points=current_points,
                    required_points=required_points,
                    message=f"积分不足无法生成图片，当前积分: {current_points}，需要积分: {required_points}"
                )
            
            logger.info(f"Points check passed for user {user_id}: {current_points} >= {required_points}")
            
        except InsufficientPointsError:
            # 重新抛出积分不足异常
            raise
        except Exception as e:
            logger.error(f"Error checking points for user {user_id}: {e}")
            # 其他错误也作为积分不足处理，确保系统安全
            raise InsufficientPointsError(
                current_points=0,
                required_points=required_points,
                message=f"检查积分时发生错误，暂时无法生成图片"
            )

# 创建单例实例
points_service = PointsService()