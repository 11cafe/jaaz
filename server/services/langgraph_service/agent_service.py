from models.tool_model import ToolInfoJson
from services.db_service import db_service
from .StreamProcessor import StreamProcessor
from .agent_manager import AgentManager
import traceback
from utils.http_client import HttpClient
from langgraph_swarm import create_swarm  # type: ignore
from langchain_openai import ChatOpenAI
from langchain_ollama import ChatOllama
from services.websocket_service import send_to_websocket  # type: ignore
from services.config_service import config_service
from typing import Optional, List, Dict, Any, cast, Set, TypedDict
from models.config_model import ModelInfo
import base64
import os
from routers.templates_router import TEMPLATES


class ContextInfo(TypedDict):
    """Context information passed to tools"""
    canvas_id: str
    session_id: str
    model_info: Dict[str, List[ModelInfo]]


def _fix_chat_history(messages: List[Dict[str, Any]], 
                      template_id: str,
                      template_prompt: Optional[str] = None) -> List[Dict[str, Any]]:
    """修复聊天历史中不完整的工具调用

    根据LangGraph文档建议，移除没有对应ToolMessage的tool_calls
    参考: https://langchain-ai.github.io/langgraph/troubleshooting/errors/INVALID_CHAT_HISTORY/
    """
    if not messages:
        return messages

    fixed_messages: List[Dict[str, Any]] = []
    tool_call_ids: Set[str] = set()

    # 第一遍：收集所有ToolMessage的tool_call_id
    for msg in messages:
        if msg.get('role') == 'tool' and msg.get('tool_call_id'):
            tool_call_id = msg.get('tool_call_id')
            if tool_call_id:
                tool_call_ids.add(tool_call_id)

    # 第二遍：修复AIMessage中的tool_calls
    for msg in messages:
        if msg.get('role') == 'assistant' and msg.get('tool_calls'):
            # 过滤掉没有对应ToolMessage的tool_calls
            valid_tool_calls: List[Dict[str, Any]] = []
            removed_calls: List[str] = []

            for tool_call in msg.get('tool_calls', []):
                tool_call_id = tool_call.get('id')
                if tool_call_id in tool_call_ids:
                    valid_tool_calls.append(tool_call)
                elif tool_call_id:
                    removed_calls.append(tool_call_id)

            # 记录修复信息
            if removed_calls:
                print(
                    f"🔧 修复消息历史：移除了 {len(removed_calls)} 个不完整的工具调用: {removed_calls}")

            # 更新消息
            if valid_tool_calls:
                msg_copy = msg.copy()
                msg_copy['tool_calls'] = valid_tool_calls
                fixed_messages.append(msg_copy)
            elif msg.get('content'):  # 如果没有有效的tool_calls但有content，保留消息
                msg_copy = msg.copy()
                msg_copy.pop('tool_calls', None)  # 移除空的tool_calls
                fixed_messages.append(msg_copy)
            # 如果既没有有效tool_calls也没有content，跳过这条消息
        elif msg.get('role') == 'user' and template_prompt:
            content = msg.get('content', [])
            
            # 处理字符串格式的content
            if isinstance(content, str):
                fixed_messages.append({
                    'role': 'user',
                    'content': template_prompt
                })
            # 处理列表格式的content
            elif isinstance(content, list):
                new_content: List[Dict[str, Any]] = []
                for content_item in content:
                    if isinstance(content_item, dict) and content_item.get('type') == 'text':
                        content_item['text'] = template_prompt
                        new_content.append(content_item)
                    else:
                        new_content.append(content_item)
                        
                fixed_messages.append({
                    'role': 'user',
                    'content': new_content
                })
            else:
                # 其他格式直接保留
                fixed_messages.append(msg)
        else:
            # 非assistant消息或没有tool_calls的消息直接保留
            fixed_messages.append(msg)
            
    new_messages: List[Dict[str, Any]] = []
    if template_id:
        for msg in fixed_messages:
            if msg.get('role') == 'user':
                try:
                    template = next((t for t in TEMPLATES if t["id"] == int(template_id)), None)
                    if template and template.get("image"):
                        image_path = template["image"]
                        print(f"🖼️ 模板图片路径: {image_path}")
                        # 构建完整路径
                        # image_path 是 /static/template_images/nizhen.png 格式的URL
                        # 去掉开头的 / 并直接使用
                        full_image_path = image_path.lstrip('/')
                        print(f"📁 完整文件路径: {full_image_path}")
                        
                        if os.path.exists(full_image_path):
                            with open(full_image_path, "rb") as image_file:
                                image_data = image_file.read()
                                base64_string = base64.b64encode(image_data).decode('utf-8')
                                
                                # 根据文件扩展名确定MIME类型
                                if image_path.lower().endswith('.png'):
                                    mime_type = 'image/png'
                                elif image_path.lower().endswith('.jpg') or image_path.lower().endswith('.jpeg'):
                                    mime_type = 'image/jpeg'
                                else:
                                    mime_type = 'image/jpeg'  # 默认
                                
                                # 处理content格式
                                content = msg.get("content", [])
                                if isinstance(content, str):
                                    # 如果content是字符串，转换为列表格式
                                    msg["content"] = [
                                        {"type": "text", "text": content},
                                        {
                                            "type": "image_url",
                                            "image_url": {
                                                "url": f'data:{mime_type};base64,{base64_string}'
                                            }
                                        }
                                    ]
                                elif isinstance(content, list):
                                    # 如果content已经是列表，追加图片
                                    content.append({
                                        "type": "image_url",
                                        "image_url": {
                                            "url": f'data:{mime_type};base64,{base64_string}'
                                        }
                                    })
                        else:
                            print(f"❌ 模板图片文件不存在: {full_image_path}")
                    new_messages.append(msg)
                except Exception as e:
                    print(f"❌ 加载模板图片失败: {e}")
                    import traceback
                    traceback.print_exc()
            else:
                new_messages.append(msg)
    else:
        new_messages = fixed_messages
    return new_messages


async def langgraph_multi_agent(
    messages: List[Dict[str, Any]],
    canvas_id: str,
    session_id: str,
    text_model: ModelInfo,
    tool_list: List[ToolInfoJson],
    system_prompt: Optional[str] = None,
    template_id: str = "",
    template_prompt: Optional[str] = None
) -> None:
    """多智能体处理函数

    Args:
        messages: 消息历史
        canvas_id: 画布ID
        session_id: 会话ID
        text_model: 文本模型配置
        tool_list: 工具模型配置列表（图像或视频模型）
        system_prompt: 系统提示词
    """
    try:
        print("langgraph_multi_agent")
        # 0. 修复消息历史
        fixed_messages = _fix_chat_history(messages, template_id, template_prompt)

        # 2. 文本模型
        text_model_instance = _create_text_model(text_model)

        # 3. 创建智能体
        if not template_prompt:
            agents = AgentManager.create_agents(
                text_model_instance,
                tool_list,  # 传入所有注册的工具
                system_prompt or "",
                template_prompt or ""
            )
        else:
            agents = AgentManager.create_agents(
                text_model_instance,
                tool_list,  # 传入所有注册的工具
                system_prompt = """直接调用相关工具""",
                template_prompt = template_prompt or ""
            )
        
        agent_names = [agent.name for agent in agents]
        print('👇agent_names', agent_names)
        last_agent = AgentManager.get_last_active_agent(
            fixed_messages, agent_names)

        print('👇last_agent', last_agent)

        # 4. 创建智能体群组
        swarm = create_swarm(
            agents=agents,  # type: ignore
            default_active_agent=last_agent if last_agent else agent_names[0]
        )

        # 5. 创建上下文
        context = {
            'canvas_id': canvas_id,
            'session_id': session_id,
            'tool_list': tool_list,
        }

        print('👇测试走到了这里')
        # 6. 流处理
        processor = StreamProcessor(
            session_id, db_service, send_to_websocket)  # type: ignore
        await processor.process_stream(swarm, fixed_messages, context)

    except Exception as e:
        await _handle_error(e, session_id)


def _create_text_model(text_model: ModelInfo) -> Any:
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
        http_client = HttpClient.create_sync_client()
        http_async_client = HttpClient.create_async_client()
        print('👇_create_text_model model', model)
        return ChatOpenAI(
            model=model,
            api_key=api_key,  # type: ignore
            timeout=300,
            base_url=url,
            temperature=0,
            # max_tokens=max_tokens, # TODO: 暂时注释掉有问题的参数
            http_client=http_client,
            http_async_client=http_async_client
        )


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
