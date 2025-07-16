from typing import Dict, Any
from tools.generate_video_by_kling_v2_jaaz import set_tool_confirmation


async def handle_tool_confirmation(data: Dict[str, Any]) -> None:
    """
    Handle tool confirmation requests from the frontend

    Args:
        data: Dictionary containing confirmation data
            - tool_call_id: The tool call ID to confirm
            - confirmed: Boolean indicating if the tool should be executed
    """
    tool_call_id = data.get('tool_call_id')
    confirmed = data.get('confirmed', False)

    if not tool_call_id:
        print(f"❌ Missing tool_call_id in confirmation request")
        return

    print(
        f"🛠️ Tool confirmation received: tool_call_id={tool_call_id}, confirmed={confirmed}")

    # 设置工具确认状态
    set_tool_confirmation(tool_call_id, confirmed)
