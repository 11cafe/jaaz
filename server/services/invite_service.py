import secrets
import string
from typing import Dict, Any, Optional
from .db_service import db_service
from .points_service import points_service
from log import get_logger

logger = get_logger(__name__)

class InviteService:
    """邀请系统服务类"""
    
    def __init__(self):
        self.invite_reward = 50  # 邀请者获得的积分
        self.register_reward = 10  # 被邀请者获得的积分
        self.max_invites = 500   # 每个用户最大邀请数量
    
    def generate_invite_code(self, length: int = 6) -> str:
        """
        生成6位字母数字组合的邀请码
        避免容易混淆的字符：0, O, 1, I, l
        """
        # 避免混淆的字符集合
        chars = string.ascii_uppercase + string.digits
        # 移除容易混淆的字符
        chars = chars.replace('0', '').replace('O', '').replace('1', '').replace('I', '')
        
        return ''.join(secrets.choice(chars) for _ in range(length))
    
    async def get_or_create_invite_code(self, user_id: int, user_uuid: str) -> Dict[str, Any]:
        """
        获取或创建用户的邀请码
        
        Returns:
            Dict包含code, used_count, max_uses等信息
        """
        try:
            # 先尝试获取现有的邀请码
            existing_code = await db_service.get_invite_code_by_user(user_uuid)
            
            if existing_code:
                logger.info(f"Found existing invite code for user {user_id}: {existing_code['code']}")
                return {
                    'success': True,
                    'code': existing_code['code'],
                    'used_count': existing_code['used_count'],
                    'max_uses': existing_code['max_uses'],
                    'remaining_uses': existing_code['max_uses'] - existing_code['used_count'],
                    'is_active': existing_code['is_active'],
                    'created_at': existing_code['created_at']
                }
            
            # 生成新的邀请码，确保唯一性
            max_attempts = 10
            for attempt in range(max_attempts):
                new_code = self.generate_invite_code()
                
                # 检查邀请码是否已存在
                existing = await db_service.get_invite_code_by_code(new_code)
                if not existing:
                    # 创建新邀请码
                    success = await db_service.create_invite_code(user_id, user_uuid, new_code)
                    
                    if success:
                        logger.info(f"Created new invite code for user {user_id}: {new_code}")
                        return {
                            'success': True,
                            'code': new_code,
                            'used_count': 0,
                            'max_uses': self.max_invites,
                            'remaining_uses': self.max_invites,
                            'is_active': True,
                            'created_at': None  # 刚创建，时间由数据库设置
                        }
                    else:
                        logger.error(f"Failed to create invite code {new_code} for user {user_id}")
                        break
            
            # 如果多次尝试都失败了
            logger.error(f"Failed to generate unique invite code for user {user_id} after {max_attempts} attempts")
            return {
                'success': False,
                'error': 'Failed to generate unique invite code'
            }
            
        except Exception as e:
            logger.error(f"Error getting or creating invite code for user {user_id}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def validate_invite_code(self, code: str) -> Dict[str, Any]:
        """
        验证邀请码是否有效
        
        Returns:
            Dict包含is_valid, reason, inviter_info等信息
        """
        try:
            if not code or len(code.strip()) == 0:
                return {
                    'is_valid': False,
                    'reason': 'Invite code is required'
                }
            
            code = code.strip().upper()
            
            # 获取邀请码信息
            invite_info = await db_service.get_invite_code_by_code(code)
            
            if not invite_info:
                return {
                    'is_valid': False,
                    'reason': 'Invalid invite code'
                }
            
            if not invite_info['is_active']:
                return {
                    'is_valid': False,
                    'reason': 'Invite code is inactive'
                }
            
            if invite_info['used_count'] >= invite_info['max_uses']:
                return {
                    'is_valid': False,
                    'reason': 'Invite code usage limit reached'
                }
            
            return {
                'is_valid': True,
                'inviter_id': invite_info['user_id'],
                'inviter_uuid': invite_info['user_uuid'],
                'inviter_email': invite_info['inviter_email'],
                'inviter_nickname': invite_info['inviter_nickname'],
                'used_count': invite_info['used_count'],
                'max_uses': invite_info['max_uses'],
                'remaining_uses': invite_info['max_uses'] - invite_info['used_count']
            }
            
        except Exception as e:
            logger.error(f"Error validating invite code {code}: {e}")
            return {
                'is_valid': False,
                'reason': 'Internal error during validation'
            }
    
    async def process_invitation_registration(self, invite_code: str, invitee_email: str,
                                            invitee_id: int, invitee_uuid: str,
                                            registration_ip: str = None,
                                            registration_user_agent: str = None,
                                            device_fingerprint: str = None) -> Dict[str, Any]:
        """
        处理通过邀请码注册的完整流程
        
        Returns:
            Dict包含success, invitation_id, points_awarded等信息
        """
        try:
            # 1. 验证邀请码
            validation = await self.validate_invite_code(invite_code)
            if not validation['is_valid']:
                return {
                    'success': False,
                    'reason': validation['reason']
                }
            
            inviter_id = validation['inviter_id']
            inviter_uuid = validation['inviter_uuid']
            
            # 2. 检查防刷限制
            if registration_ip or device_fingerprint:
                spam_check = await db_service.check_anti_spam_limits(
                    registration_ip or '', device_fingerprint or ''
                )
                
                if spam_check['ip_limit_exceeded']:
                    logger.warning(f"IP limit exceeded for registration: {registration_ip}")
                    return {
                        'success': False,
                        'reason': 'Too many registrations from this IP address. Please try again later.'
                    }
                
                if spam_check['device_limit_exceeded']:
                    logger.warning(f"Device limit exceeded for registration: {device_fingerprint}")
                    return {
                        'success': False,
                        'reason': 'This device has already been used for registration.'
                    }
            
            # 3. 创建邀请记录
            invitation_id = await db_service.create_invitation_record(
                inviter_id, inviter_uuid, invite_code, invitee_email,
                registration_ip, registration_user_agent, device_fingerprint
            )
            
            if not invitation_id:
                return {
                    'success': False,
                    'reason': 'Failed to create invitation record'
                }
            
            # 4. 发放积分给邀请者
            inviter_points_success = await points_service.add_points(
                inviter_id, inviter_uuid, self.invite_reward,
                'earn_invite', f'Invited user {invitee_email}',
                str(invitation_id)
            )
            
            # 5. 发放积分给被邀请者
            invitee_points_success = await points_service.add_points(
                invitee_id, invitee_uuid, self.register_reward,
                'earn_register', f'Registered with invite code {invite_code}',
                str(invitation_id)
            )
            
            # 6. 更新邀请码使用次数
            await db_service.update_invite_code_usage(invite_code)
            
            # 7. 完成邀请记录
            inviter_points_awarded = self.invite_reward if inviter_points_success else 0
            invitee_points_awarded = self.register_reward if invitee_points_success else 0
            
            await db_service.complete_invitation(
                invitation_id, invitee_id, invitee_uuid,
                inviter_points_awarded, invitee_points_awarded
            )
            
            logger.info(f"Successfully processed invitation: inviter={inviter_id}, invitee={invitee_id}, code={invite_code}")
            
            return {
                'success': True,
                'invitation_id': invitation_id,
                'inviter_points_awarded': inviter_points_awarded,
                'invitee_points_awarded': invitee_points_awarded,
                'inviter_email': validation['inviter_email'],
                'inviter_nickname': validation['inviter_nickname']
            }
            
        except Exception as e:
            logger.error(f"Error processing invitation registration: {e}")
            return {
                'success': False,
                'reason': 'Internal error during invitation processing'
            }
    
    async def get_invitation_stats(self, user_uuid: str) -> Dict[str, Any]:
        """获取用户邀请统计信息"""
        try:
            return await db_service.get_invitation_stats(user_uuid)
        except Exception as e:
            logger.error(f"Error getting invitation stats for user {user_uuid}: {e}")
            return {}
    
    async def get_invitation_history(self, user_uuid: str, limit: int = 20, offset: int = 0) -> Dict[str, Any]:
        """获取用户邀请历史"""
        try:
            history = await db_service.get_invitation_history(user_uuid, limit, offset)
            return {
                'success': True,
                'history': history,
                'total_count': len(history)  # 这里简化处理，实际应该查询总数
            }
        except Exception as e:
            logger.error(f"Error getting invitation history for user {user_uuid}: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def check_invite_code_availability(self, code: str) -> bool:
        """检查邀请码是否可用（未被使用）"""
        try:
            existing = await db_service.get_invite_code_by_code(code)
            return existing is None
        except Exception as e:
            logger.error(f"Error checking invite code availability {code}: {e}")
            return False

# 创建单例实例
invite_service = InviteService()