import asyncio
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class ToolConfirmationRequest:
    tool_call_id: str
    session_id: str
    tool_name: str
    arguments: Dict[str, Any]
    created_at: datetime
    confirmed: Optional[bool] = None


class ToolConfirmationManager:
    """工具确认管理器"""

    def __init__(self):
        self.pending_confirmations: Dict[str, ToolConfirmationRequest] = {}
        self.confirmation_timeout = timedelta(minutes=5)  # 5分钟超时

    async def request_confirmation(self, tool_call_id: str, session_id: str, tool_name: str, arguments: Dict[str, Any]) -> bool:
        """请求工具确认，返回是否已确认"""
        request = ToolConfirmationRequest(
            tool_call_id=tool_call_id,
            session_id=session_id,
            tool_name=tool_name,
            arguments=arguments,
            created_at=datetime.now()
        )

        self.pending_confirmations[tool_call_id] = request

        # 等待确认或超时
        try:
            await asyncio.wait_for(
                self._wait_for_confirmation(tool_call_id),
                timeout=self.confirmation_timeout.total_seconds()
            )
            return request.confirmed is True
        except asyncio.TimeoutError:
            # 超时，自动取消
            self.cancel_confirmation(tool_call_id)
            return False

    async def _wait_for_confirmation(self, tool_call_id: str):
        """等待确认"""
        while tool_call_id in self.pending_confirmations:
            request = self.pending_confirmations[tool_call_id]
            if request.confirmed is not None:
                return
            await asyncio.sleep(0.1)

    def confirm_tool(self, tool_call_id: str) -> bool:
        """确认工具调用"""
        if tool_call_id in self.pending_confirmations:
            self.pending_confirmations[tool_call_id].confirmed = True
            return True
        return False

    def cancel_confirmation(self, tool_call_id: str) -> bool:
        """取消工具调用"""
        if tool_call_id in self.pending_confirmations:
            self.pending_confirmations[tool_call_id].confirmed = False
            return True
        return False

    def get_pending_request(self, tool_call_id: str) -> Optional[ToolConfirmationRequest]:
        """获取待确认的请求"""
        return self.pending_confirmations.get(tool_call_id)

    def cleanup_expired(self):
        """清理过期的确认请求"""
        now = datetime.now()
        expired_ids = [
            tool_call_id for tool_call_id, request in self.pending_confirmations.items()
            if now - request.created_at > self.confirmation_timeout
        ]
        for tool_call_id in expired_ids:
            del self.pending_confirmations[tool_call_id]


# 全局实例
tool_confirmation_manager = ToolConfirmationManager()
