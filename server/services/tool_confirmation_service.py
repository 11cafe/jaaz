import json
from typing import Dict, Any
from services.websocket_service import send_to_websocket
from tools.video_providers.jaaz_kling_provider import JaazKlingProvider
from tools.video_generation.video_canvas_utils import send_video_start_notification, process_video_result
from tools.utils.image_utils import process_input_image


async def handle_tool_confirmation(data: Dict[str, Any]) -> None:
    """
    Handle tool confirmation requests from the frontend

    Args:
        data: Dictionary containing confirmation data
            - session_id: The session ID
            - tool_call_id: The tool call ID to confirm
            - confirmed: Boolean indicating if the tool should be executed
            - tool_arguments: The original tool arguments
    """
    session_id = data.get('session_id')
    tool_call_id = data.get('tool_call_id')
    confirmed = data.get('confirmed', False)
    tool_arguments = data.get('tool_arguments', {})

    if not session_id or not tool_call_id:
        print(
            f"❌ Missing required parameters: session_id={session_id}, tool_call_id={tool_call_id}")
        return

    print(
        f"🛠️ Tool confirmation received: session_id={session_id}, tool_call_id={tool_call_id}, confirmed={confirmed}")

    if not confirmed:
        # User cancelled the tool execution
        await send_to_websocket(session_id, {
            'type': 'tool_call_cancelled',
            'id': tool_call_id
        })
        return

    # User confirmed the tool execution
    await send_to_websocket(session_id, {
        'type': 'tool_call_confirmed',
        'id': tool_call_id
    })

    try:
        # Execute the confirmed tool based on the tool name
        tool_name = tool_arguments.get('name', '')

        if tool_name == 'generate_video_by_kling_v2_jaaz':
            # Parse arguments if they're in string format
            if isinstance(tool_arguments.get('arguments'), str):
                try:
                    parsed_args = json.loads(
                        tool_arguments.get('arguments', '{}'))
                except json.JSONDecodeError:
                    parsed_args = {}
            else:
                parsed_args = tool_arguments

            canvas_id = data.get('canvas_id', '')

            # Execute video generation directly
            result = await execute_video_generation(
                session_id=session_id,
                canvas_id=canvas_id,
                tool_call_id=tool_call_id,
                prompt=parsed_args.get('prompt', ''),
                input_images=parsed_args.get('input_images', []),
                negative_prompt=parsed_args.get('negative_prompt', ''),
                guidance_scale=parsed_args.get('guidance_scale', 0.5),
                aspect_ratio=parsed_args.get('aspect_ratio', '16:9'),
                duration=parsed_args.get('duration', 5)
            )

            # Send the result back to the frontend
            await send_to_websocket(session_id, {
                'type': 'tool_call_result',
                'id': tool_call_id,
                'message': {
                    'role': 'tool',
                    'content': result
                }
            })
        else:
            print(f"❌ Unknown tool name: {tool_name}")

    except Exception as e:
        print(f"❌ Error executing confirmed tool: {e}")
        await send_to_websocket(session_id, {
            'type': 'tool_call_result',
            'id': tool_call_id,
            'message': {
                'role': 'tool',
                'content': f"Error executing tool: {str(e)}"
            }
        })


async def execute_video_generation(
    session_id: str,
    canvas_id: str,
    tool_call_id: str,
    prompt: str,
    input_images: list[str],
    negative_prompt: str = "",
    guidance_scale: float = 0.5,
    aspect_ratio: str = "16:9",
    duration: int = 5,
) -> str:
    """
    Execute video generation after user confirmation
    """
    print(
        f'🛠️ Executing confirmed video generation for tool_call_id: {tool_call_id}')

    try:
        # Validate input_images is provided and not empty
        if not input_images or len(input_images) == 0:
            raise ValueError(
                "input_images is required and cannot be empty. Please provide at least one image.")

        # Send start notification
        await send_video_start_notification(
            session_id,
            f"Starting Kling video generation..."
        )

        # Process input images (use first image as start_image)
        first_image = input_images[0]
        processed_image = await process_input_image(first_image)
        if not processed_image:
            raise ValueError(
                f"Failed to process input image: {first_image}. Please check if the image exists and is valid.")

        processed_start_image = processed_image
        print(
            f"Using first input image as start image for Kling video generation: {first_image}")

        # Create Kling provider and generate video
        provider = JaazKlingProvider()
        video_url = await provider.generate(
            prompt=prompt,
            model="kling-v2.1-standard",
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            aspect_ratio=aspect_ratio,
            duration=duration,
            start_image=processed_start_image,
        )

        # Process video result (save, update canvas, notify)
        return await process_video_result(
            video_url=video_url,
            session_id=session_id,
            canvas_id=canvas_id,
            provider_name="jaaz_kling",
        )

    except Exception as e:
        print(f"Error in confirmed video generation: {e}")
        raise e
