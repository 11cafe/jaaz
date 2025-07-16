# type: ignore[import]
import traceback
from typing import Optional, List, Dict, Any, Callable, Awaitable
from langchain_core.messages import AIMessageChunk, ToolCall, convert_to_openai_messages, ToolMessage
from langgraph.graph import StateGraph
import json


class StreamProcessor:
    """流式处理器 - 负责处理智能体的流式输出"""

    def __init__(self, session_id: str, db_service: Any, websocket_service: Callable[[str, Dict[str, Any]], Awaitable[None]]):
        self.session_id = session_id
        self.db_service = db_service
        self.websocket_service = websocket_service
        self.tool_calls: List[ToolCall] = []
        self.last_saved_message_index = 0
        self.last_streaming_tool_call_id: Optional[str] = None
        # tool_call_id -> tool_data
        self.pending_confirmations: Dict[str, Dict[str, Any]] = {}

    async def process_stream(self, swarm: StateGraph, messages: List[Dict[str, Any]], context: Dict[str, Any]) -> None:
        """处理整个流式响应

        Args:
            swarm: 智能体群组
            messages: 消息列表
            context: 上下文信息
        """
        self.last_saved_message_index = len(messages) - 1

        compiled_swarm = swarm.compile()

        async for chunk in compiled_swarm.astream(
            {"messages": messages},
            config=context,
            stream_mode=["messages", "custom", 'values']
        ):
            await self._handle_chunk(chunk)

        # 发送完成事件
        await self.websocket_service(self.session_id, {
            'type': 'done'
        })

    async def _handle_chunk(self, chunk: Any) -> None:
        # print('👇chunk', chunk)
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

    async def _handle_message_chunk(self, ai_message_chunk: AIMessageChunk) -> None:
        """处理消息类型的 chunk"""
        # print('👇ai_message_chunk', ai_message_chunk)
        try:
            content = ai_message_chunk.content

            if isinstance(ai_message_chunk, ToolMessage):
                # 工具调用结果之后会在 values 类型中发送到前端，这里会更快出现一些
                oai_message = convert_to_openai_messages([ai_message_chunk])[0]
                print('👇toolcall res oai_message', oai_message)
                await self.websocket_service(self.session_id, {
                    'type': 'tool_call_result',
                    'id': ai_message_chunk.tool_call_id,
                    'message': oai_message
                })
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
        except Exception as e:
            print('🟠error', e)
            traceback.print_stack()

    async def _handle_tool_calls(self, tool_calls: List[ToolCall]) -> None:
        """处理工具调用"""
        self.tool_calls = [tc for tc in tool_calls if tc.get('name')]
        print('😘tool_call event', tool_calls)

        for tool_call in self.tool_calls:
            tool_name = tool_call.get('name')

            # 存储工具调用信息用于确认
            self.pending_confirmations[tool_call.get('id')] = {
                'name': tool_name,
                'arguments': tool_call.get('args', '{}')
            }

            # 对于需要确认的工具，发送确认请求
            if tool_name == 'generate_video_by_kling_v2_jaaz':
                await self.websocket_service(self.session_id, {
                    'type': 'tool_call_pending_confirmation',
                    'id': tool_call.get('id'),
                    'name': tool_name
                })
            else:
                # 对于其他工具，正常发送工具调用事件
                await self.websocket_service(self.session_id, {
                    'type': 'tool_call',
                    'id': tool_call.get('id'),
                    'name': tool_name,
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

                    # 更新待确认的工具调用参数
                    if self.last_streaming_tool_call_id in self.pending_confirmations:
                        current_args = self.pending_confirmations[self.last_streaming_tool_call_id].get(
                            'arguments', '')
                        self.pending_confirmations[self.last_streaming_tool_call_id][
                            'arguments'] = current_args + tool_call_chunk.get('args', '')
                else:
                    print('🟠no last_streaming_tool_call_id', tool_call_chunk)
