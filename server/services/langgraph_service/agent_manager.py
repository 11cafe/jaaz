from typing import List, Dict, Any, Optional
from langgraph.prebuilt import create_react_agent  # type: ignore
from langgraph.graph.graph import CompiledGraph
from langchain_core.tools import BaseTool
from models.tool_model import ToolInfoJson
from services.langgraph_service.configs.image_vide_creator_config import ImageVideoCreatorAgentConfig
from services.langgraph_service.configs.magic_agent_config import MagicIntentAgentConfig, MagicDrawAgentConfig
from .configs import PlannerAgentConfig, create_handoff_tool, BaseAgentConfig
from services.tool_service import tool_service


class AgentManager:
    """智能体管理器 - 负责创建和管理所有智能体

    此类负责协调智能体配置的获取和实际 LangGraph 智能体的创建。
    """

    @staticmethod
    def create_agents(
        model: Any,
        tool_list: List[ToolInfoJson],
        system_prompt: str = ""
    ) -> List[CompiledGraph]:
        """创建所有智能体

        Args:
            model: 语言模型实例
            registered_tools: 已注册的工具名称列表
            system_prompt: 系统提示词

        Returns:
            List[Any]: 创建好的智能体列表
        """
        # 为不同类型的智能体过滤合适的工具
        image_tools = [
            tool for tool in tool_list if tool.get('type') == 'image']
        video_tools = [
            tool for tool in tool_list if tool.get('type') == 'video']

        print(f"📸 图像工具: {image_tools}")
        print(f"🎬 视频工具: {video_tools}")

        planner_config = PlannerAgentConfig()
        planner_agent = AgentManager._create_langgraph_agent(
            model, planner_config)

        # image_designer_config = ImageDesignerAgentConfig(
        #     image_tools, system_prompt)
        # print('👇image_designer_config tools', image_designer_config.tools)
        # print('👇image_designer_config system_prompt', image_designer_config.system_prompt)
        # image_designer_agent = AgentManager._create_langgraph_agent(
        #     model, image_designer_config)

        # video_designer_config = VideoDesignerAgentConfig(
        #     video_tools)
        # video_designer_agent = AgentManager._create_langgraph_agent(
        #     model, video_designer_config)

        image_video_creator_config = ImageVideoCreatorAgentConfig(tool_list)
        image_video_creator_agent = AgentManager._create_langgraph_agent(
            model, image_video_creator_config)

        return [planner_agent, image_video_creator_agent]

    @staticmethod
    def create_magic_agents(
        model: Any,
    ) -> List[CompiledGraph]:
        """创建魔法图片生成智能体

        Args:
            model: 语言模型实例

        Returns:
            List[CompiledGraph]: 创建好的魔法智能体列表
        """
        print("🎨 创建魔法智能体...")

        # 创建 Intent Agent 配置
        intent_config = MagicIntentAgentConfig()
        intent_agent = AgentManager._create_langgraph_agent(
            model, intent_config)

        # 创建 Draw Agent 配置（工具已在配置中指定）
        draw_config = MagicDrawAgentConfig()
        print(f"🎨 Draw Agent 配置:")
        print(
            f"   - 工具列表: {[tool.get('id', 'unknown') for tool in draw_config.tools]}")

        draw_agent = AgentManager._create_langgraph_agent(
            model, draw_config)

        return [intent_agent, draw_agent]

    @staticmethod
    def _create_langgraph_agent(
        model: Any,
        config: BaseAgentConfig
    ) -> CompiledGraph:
        """根据配置创建单个 LangGraph 智能体

        Args:
            model: 语言模型实例
            config: 智能体配置字典

        Returns:
            Any: 创建好的 LangGraph 智能体实例
        """
        # 创建智能体间切换工具
        handoff_tools: List[BaseTool] = []
        for handoff in config.handoffs:
            handoff_tool = create_handoff_tool(
                agent_name=handoff['agent_name'],
                description=handoff['description'],
            )
            if handoff_tool:
                handoff_tools.append(handoff_tool)
            else:
                print(f"   ❌ Handoff 工具创建失败: {handoff['agent_name']}")

        # 获取业务工具
        business_tools: List[BaseTool] = []
        for tool_json in config.tools:
            tool_id = tool_json['id']
            tool = tool_service.get_tool(tool_id)
            if tool:
                business_tools.append(tool)

        # 创建并返回 LangGraph 智能体
        agent = create_react_agent(
            name=config.name,
            model=model,
            tools=[*business_tools, *handoff_tools],
            prompt=config.system_prompt
        )

        return agent

    @staticmethod
    def get_last_active_agent(
        messages: List[Dict[str, Any]],
        agent_names: List[str]
    ) -> Optional[str]:
        """获取最后活跃的智能体

        Args:
            messages: 消息历史
            agent_names: 智能体名称列表

        Returns:
            Optional[str]: 最后活跃的智能体名称，如果没有则返回 None
        """
        for message in reversed(messages):
            if message.get('role') == 'assistant':
                message_name = message.get('name')
                if message_name and message_name in agent_names:
                    return message_name
        return None
