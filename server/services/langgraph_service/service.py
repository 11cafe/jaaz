from typing import Optional, List, Dict, Any, cast, Set
from models.config_model import ModelInfo
from services.db_service import db_service
from services.config_service import config_service
from services.websocket_service import send_to_websocket  # type: ignore
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph_swarm import create_swarm  # type: ignore
from utils.http_client import HttpClient

import traceback

from .agent_manager import AgentManager
from .handlers import StreamProcessor


def _fix_chat_history(messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """修复聊天历史中不完整的工具调用

    策略：确保每个tool消息都有对应的tool_calls，移除孤立的消息
    参考: https://langchain-ai.github.io/langgraph/troubleshooting/errors/INVALID_CHAT_HISTORY/
    """
    if not messages:
        return messages

    print('👇messages', messages)
    fixed_messages: List[Dict[str, Any]] = []
    tool_call_ids: Set[str] = set()

    # 第一遍：收集所有ToolMessage的tool_call_id
    for msg in messages:
        if msg.get('role') == 'tool' and msg.get('tool_call_id'):
            tool_call_id = msg.get('tool_call_id')
            if tool_call_id:
                tool_call_ids.add(tool_call_id)

    # 第二遍：处理所有消息，确保tool_calls和tool消息的配对
    valid_tool_call_ids: Set[str] = set()

    for msg in messages:
        if msg.get('role') == 'assistant' and msg.get('tool_calls'):
            # 处理assistant消息的tool_calls
            valid_tool_calls: List[Dict[str, Any]] = []
            removed_tool_calls: List[str] = []

            for tool_call in msg.get('tool_calls', []):
                tool_call_id = tool_call.get('id')
                if tool_call_id in tool_call_ids:
                    # 有对应ToolMessage的工具调用，保留
                    valid_tool_calls.append(tool_call)
                    valid_tool_call_ids.add(tool_call_id)
                elif tool_call_id:
                    # 没有对应ToolMessage的工具调用，记录为移除
                    removed_tool_calls.append(tool_call_id)

            # 记录移除的工具调用
            if removed_tool_calls:
                print(f"🔧 移除不完整的工具调用: {removed_tool_calls}")

            # 构建修复后的assistant消息
            if valid_tool_calls or msg.get('content'):
                msg_copy = msg.copy()
                if valid_tool_calls:
                    msg_copy['tool_calls'] = valid_tool_calls
                else:
                    msg_copy.pop('tool_calls', None)
                fixed_messages.append(msg_copy)

                # 为移除的工具调用添加说明消息
                for removed_id in removed_tool_calls:
                    # 找到对应的工具名称
                    tool_name = 'unknown'
                    for tc in msg.get('tool_calls', []):
                        if tc.get('id') == removed_id:
                            tool_name = tc.get('function', {}).get(
                                'name', 'unknown')
                            break

                    notification_message = {
                        'role': 'assistant',
                        'content': f"🔄 工具调用未完成: {tool_name} (可能被中断或出现错误)"
                    }
                    fixed_messages.append(notification_message)

        elif msg.get('role') == 'tool' and msg.get('tool_call_id'):
            # 处理tool消息，只保留有效的
            tool_call_id = msg.get('tool_call_id')
            if tool_call_id in valid_tool_call_ids:
                fixed_messages.append(msg)
            else:
                print(f"🔧 移除孤立的tool消息: {tool_call_id}")
        else:
            # 其他类型的消息直接保留
            fixed_messages.append(msg)

    return fixed_messages


async def langgraph_multi_agent(
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    text_model: ModelInfo,
    image_model: ModelInfo,
    system_prompt: Optional[str] = None
) -> None:
    """多智能体处理函数

    Args:
        messages: 消息历史
        canvas_id: 画布ID
        session_id: 会话ID
        text_model: 文本模型配置
        image_model: 图像模型配置
        system_prompt: 系统提示词
    """
    try:
        # 0. 修复消息历史
        fixed_messages = _fix_chat_history(messages)

        # 1. 模型配置
        model = _create_model(text_model)
        tool_name = _determine_tool_name(
            image_model, text_model.get('provider'))

        # 2. 创建智能体
        agents = AgentManager.create_agents(
            model, tool_name, system_prompt or "")
        agent_names = ['planner', 'image_designer']
        last_agent = AgentManager.get_last_active_agent(
            fixed_messages, agent_names)

        print('👇last_agent', last_agent)

        # 3. 创建智能体群组
        swarm = create_swarm(
            agents=agents,
            default_active_agent=last_agent if last_agent else agent_names[0]
        ).compile()  # type: ignore

        # 4. 创建上下文
        context = _create_context(canvas_id, session_id, image_model)

        # 5. 流处理
        processor = StreamProcessor(
            session_id, db_service, send_to_websocket)  # type: ignore
        await processor.process_stream(swarm, fixed_messages, context)

    except Exception as e:
        await _handle_error(e, session_id)


def _create_model(text_model: ModelInfo) -> Any:
    """创建语言模型实例"""
    model = text_model.get('model')
    provider = text_model.get('provider')
    url = text_model.get('url')
    api_key = config_service.app_config.get(  # type: ignore
        provider, {}).get("api_key", "")

    # TODO: Verify if max token is working
    # max_tokens = text_model.get('max_tokens', 8148)

    if provider == 'ollama':
        return ChatOllama(
            model=model,
            base_url=url,
        )
    else:
        # Create httpx client with SSL configuration for ChatOpenAI
        http_client = HttpClient.create_sync_client(timeout=15)
        http_async_client = HttpClient.create_async_client(timeout=15)
        return ChatOpenAI(
            model=model,
            api_key=api_key,  # type: ignore
            timeout=15,
            base_url=url,
            temperature=0,
            # max_tokens=max_tokens, # TODO: 暂时注释掉有问题的参数
            http_client=http_client,
            http_async_client=http_async_client
        )


def _determine_tool_name(image_model: ModelInfo, provider: str) -> str:
    """确定图像生成工具名称"""
    image_model_name = image_model.get('model', '')
    tool_name = 'generate_image'

    is_jaaz_gpt_model = image_model_name.startswith(
        'openai') and provider == 'jaaz'
    if is_jaaz_gpt_model:
        tool_name = 'generate_image_by_gpt'
    if image_model.get('type') == 'tool':
        tool_name = image_model.get('model')

    return tool_name


def _create_context(canvas_id: str, session_id: str, image_model: ModelInfo) -> Dict[str, Any]:
    """创建上下文信息"""
    return {
        'canvas_id': canvas_id,
        'session_id': session_id,
        'model_info': {
            'image': image_model
        },
    }


async def _handle_error(error: Exception, session_id: str) -> None:
    """处理错误"""
    print('Error in langgraph_agent', error)
    tb_str = traceback.format_exc()
    print(f"Full traceback:\n{tb_str}")
    traceback.print_exc()

    await send_to_websocket(session_id, cast(Dict[str, Any], {
        'type': 'error',
        'error': str(error)
    }))
