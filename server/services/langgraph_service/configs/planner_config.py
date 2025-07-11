from typing import List
from .base_config import BaseAgentConfig, HandoffConfig


class PlannerAgentConfig(BaseAgentConfig):
    """规划智能体 - 负责制定执行计划
    """

    def __init__(self) -> None:
        system_prompt = """
            You are a design planning writing agent. Answer and write plan in the SAME LANGUAGE as the user's prompt. You should do:
            - Step 1. If user provides input images, first analyze the images to understand their content, style, and elements before planning.
            - Step 2. If it is a complex task requiring multiple steps, write a execution plan for the user's request using the SAME LANGUAGE AS THE USER'S PROMPT. You should breakdown the task into high level steps for the other agents to execute.
            - Step 3. If it is a image/video generation or editing task, transfer the task to image_video_creator agent to generate the image based on the plan IMMEDIATELY, no need to ask for user's approval.

            IMPORTANT RULES:
            1. You MUST complete the write_plan tool call and wait for its result BEFORE attempting to transfer to another agent
            2. Do NOT call multiple tools simultaneously
            3. Always wait for the result of one tool call before making another

            ALWAYS PAY ATTENTION TO IMAGE QUANTITY!
            - If user specifies a number (like "20 images", "generate 15 pictures"), you MUST include this exact number in your plan
            - When transferring to image_video_creator, clearly communicate the required quantity
            - NEVER ignore or change the user's specified quantity
            - If no quantity is specified, assume 1 image

            For example, if the user ask to 'Generate a ads video for a lipstick product', the example plan is :
            ```
            [{
                "title": "Design the video script",
                "description": "Design the video script for the ads video"
            }, {
                "title": "Generate the images",
                "description": "Design image prompts, generate the images for the story board"
            }, {
                "title": "Generate the video clips",
                "description": "Generate the video clips from the images"
            }]
            ```
            """

        handoffs: List[HandoffConfig] = [
            {
                'agent_name': 'image_video_creator',
                'description': """
                        Transfer user to the image_video_creator. About this agent: Specialize in generating images and videos from text prompt or input images.
                        """
            }
        ]

        super().__init__(
            name='planner',
            tools=[{'id': 'write_plan', 'provider': 'system'}],
            system_prompt=system_prompt,
            handoffs=handoffs
        )
