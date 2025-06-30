# type: ignore[import]
from typing import Optional, List, Dict, Any, Callable, Awaitable
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
import json
import asyncio


class StreamProcessor:
    """流式处理器 - 负责处理智能体的流式输出"""

    def __init__(self, session_id: str, db_service: Any, websocket_service: Callable[[str, Dict[str, Any]], Awaitable[None]]):
        self.session_id = session_id
        self.db_service = db_service
        self.websocket_service = websocket_service
        self.tool_calls: List[ToolCall] = []
        self.last_saved_message_index = 0
        self.last_streaming_tool_call_id: Optional[str] = None
        # 跟踪正在进行的工具调用
        self.active_tool_calls: Dict[str, str] = {}

    async def process_stream(self, swarm: Any, messages: List[Dict[str, Any]], context: Dict[str, Any]) -> None:
        """处理整个流式响应

        Args:
            swarm: 智能体群组
            messages: 消息列表
            context: 上下文信息
        """
        self.last_saved_message_index = len(messages) - 1

        try:
            async for chunk in swarm.astream(
                {"messages": messages},
                config=context,
                stream_mode=["messages", "custom", 'values']
            ):
                await self._handle_chunk(chunk)

            # 发送完成事件
            await self.websocket_service(self.session_id, {
                'type': 'done'
            })
        except asyncio.CancelledError:
            # 处理中断的工具调用
            await self._handle_interrupted_tool_calls()
            raise
        except Exception as e:
            # 处理其他异常时也清理中断的工具调用
            await self._handle_interrupted_tool_calls()
            raise

    async def _handle_interrupted_tool_calls(self) -> None:
        """处理中断的工具调用，生成相应的ToolMessage来保证消息历史完整"""
        if not self.active_tool_calls:
            return

        print(f"🔧 处理 {len(self.active_tool_calls)} 个中断的工具调用")

        for tool_call_id, tool_name in self.active_tool_calls.items():

            # 发送中断通知到前端
            await self.websocket_service(self.session_id, {
                'type': 'tool_call_interrupted',
                'tool_call_id': tool_call_id,
                'tool_name': tool_name
            })

            # 创建中断的 ToolMessage（用户友好的格式）
            interrupted_tool_message = {
                'role': 'tool',
                'tool_call_id': tool_call_id,
                'content': f"⚠️ 工具调用已中断: {tool_name}"
            }

            # 保存中断的ToolMessage到数据库
            try:
                await self.db_service.create_message(
                    self.session_id,
                    'tool',
                    json.dumps(interrupted_tool_message)
                )
                print(f"💾 已保存中断的工具调用记录: {tool_call_id}")
            except Exception as e:
                print(f"❌ 保存中断工具调用记录失败: {e}")

        # 清空活跃工具调用记录
        self.active_tool_calls.clear()

    async def _handle_chunk(self, chunk: Any) -> None:
        """处理单个chunk"""
        chunk_type = chunk[0]

        if chunk_type == 'values':
            await self._handle_values_chunk(chunk[1])
        else:
            await self._handle_message_chunk(chunk[1][0])

    async def _handle_values_chunk(self, chunk_data: Dict[str, Any]) -> None:
        """处理 values 类型的 chunk"""
        all_messages = chunk_data.get('messages', [])
        oai_messages = convert_to_openai_messages(all_messages)
        # 确保 oai_messages 是列表类型
        if not isinstance(oai_messages, list):
            oai_messages = [oai_messages] if oai_messages else []

        # 检查并移除已完成的工具调用
        self._update_completed_tool_calls(oai_messages)

        # 发送所有消息到前端
        await self.websocket_service(self.session_id, {
            'type': 'all_messages',
            'messages': oai_messages
        })

        # 保存新消息到数据库
        for i in range(self.last_saved_message_index + 1, len(oai_messages)):
            new_message = oai_messages[i]
            if len(oai_messages) > 0:  # 确保有消息才保存
                await self.db_service.create_message(
                    self.session_id,
                    new_message.get('role', 'user'),
                    json.dumps(new_message)
                )
            self.last_saved_message_index = i

    def _update_completed_tool_calls(self, messages: List[Dict[str, Any]]) -> None:
        """更新已完成的工具调用，从活跃列表中移除"""
        for message in messages:
            if message.get('role') == 'tool' and message.get('tool_call_id'):
                tool_call_id = message.get('tool_call_id')
                if tool_call_id in self.active_tool_calls:
                    print(f"✅ 工具调用已完成: {tool_call_id}")
                    del self.active_tool_calls[tool_call_id]

    async def _handle_message_chunk(self, ai_message_chunk: AIMessageChunk) -> None:
        """处理消息类型的 chunk"""
        # print('👇ai_message_chunk', ai_message_chunk)

        content = ai_message_chunk.content

        if isinstance(ai_message_chunk, ToolMessage):
            # 工具调用结果已经在 values 类型中发送到前端
            print('👇tool_call_results', ai_message_chunk.content)
        elif content:
            # 发送文本内容
            await self.websocket_service(self.session_id, {
                'type': 'delta',
                'text': content
            })
        elif hasattr(ai_message_chunk, 'tool_calls') and ai_message_chunk.tool_calls and ai_message_chunk.tool_calls[0].get('name'):
            # 处理工具调用
            await self._handle_tool_calls(ai_message_chunk.tool_calls)

        # 处理工具调用参数流
        if hasattr(ai_message_chunk, 'tool_call_chunks'):
            await self._handle_tool_call_chunks(ai_message_chunk.tool_call_chunks)

    async def _handle_tool_calls(self, tool_calls: List[ToolCall]) -> None:
        """处理工具调用"""
        self.tool_calls = [tc for tc in tool_calls if tc.get('name')]
        print('😘tool_call event', tool_calls)

        for tool_call in self.tool_calls:
            tool_call_id = tool_call.get('id')
            if tool_call_id:
                # 记录新的活跃工具调用
                self.active_tool_calls[tool_call_id] = tool_call.get(
                    'name', 'unknown')
                print(f"🟢 开始跟踪工具调用: {tool_call_id} - {tool_call.get('name')}")

            await self.websocket_service(self.session_id, {
                'type': 'tool_call',
                'id': tool_call_id,
                'name': tool_call.get('name'),
                'arguments': '{}'
            })

    async def _handle_tool_call_chunks(self, tool_call_chunks: List[Any]) -> None:
        """处理工具调用参数流"""
        for tool_call_chunk in tool_call_chunks:
            if tool_call_chunk.get('id'):
                # 标记新的流式工具调用参数开始
                self.last_streaming_tool_call_id = tool_call_chunk.get('id')
            else:
                if self.last_streaming_tool_call_id:
                    await self.websocket_service(self.session_id, {
                        'type': 'tool_call_arguments',
                        'id': self.last_streaming_tool_call_id,
                        'text': tool_call_chunk.get('args')
                    })
                else:
                    print('🟠no last_streaming_tool_call_id', tool_call_chunk)
