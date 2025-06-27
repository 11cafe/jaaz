import random
import time
import traceback
import os
import json
from typing import Optional, Annotated
from pydantic import BaseModel, Field
from langchain_core.tools import tool, InjectedToolCallId
from langchain_core.runnables import RunnableConfig
from nanoid import generate

from common import DEFAULT_PORT
from services.config_service import FILES_DIR
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update
from .video_generators import VIDEO_PROVIDERS


def generate_file_id():
    """Generate unique file ID"""
    return 'vid_' + generate(size=8)


class GenerateVideoInputSchema(BaseModel):
    prompt: str = Field(
        description="Required. The prompt for video generation describing the motion or animation you want to see.")
    image_url: str = Field(
        description="Required. The image URL or image_id to use as the starting frame for video generation. Pass image_id here, e.g. 'im_jurheut7.png'.")
    duration: str = Field(
        default="6",
        description="Optional. Video duration in seconds. Options: '6' or '10'. Default is '6'.")
    tool_call_id: Annotated[str, InjectedToolCallId]


@tool("generate_video",
      description="Generate a video from an image and text prompt using AI video generation",
      args_schema=GenerateVideoInputSchema)
async def generate_video(
    prompt: str,
    image_url: str,
    config: RunnableConfig,
    tool_call_id: Annotated[str, InjectedToolCallId],
    duration: str = "6",
) -> str:
    """
    Generate a video using the specified provider.

    Args:
        prompt (str): The prompt for video generation.
        image_url (str): The image URL or file ID to use as starting frame.
        config (RunnableConfig): The configuration for the runnable.
        tool_call_id (str): The ID of the tool call.
        duration (str): Video duration in seconds.

    Returns:
        str: Success message with video information.
    """
    print('🎬 video tool_call_id', tool_call_id)
    ctx = config.get('configurable', {})
    canvas_id = ctx.get('canvas_id', '')
    session_id = ctx.get('session_id', '')
    print('🎬 canvas_id', canvas_id, 'session_id', session_id)
    
    # Inject the tool call id into the context
    ctx['tool_call_id'] = tool_call_id

    # Get video model configuration
    model_info = ctx.get('model_info', {})
    video_model = model_info.get('video')
    
    # Always use default Fal AI Hailuo model if no video model is configured
    if not video_model or video_model is None:
        video_model = {
            'model': 'minimax/hailuo-02',
            'provider': 'fal'
        }
    
    model = video_model.get('model', 'minimax/hailuo-02')
    provider = video_model.get('provider', 'fal')

    # Get provider instance
    generator = VIDEO_PROVIDERS.get(provider)
    if not generator:
        raise ValueError(f"Unsupported video provider: {provider}")

    try:
        # Broadcast start of video generation
        await broadcast_session_update(session_id, canvas_id, {
            'type': 'tool_call_progress',
            'tool_call_id': tool_call_id,
            'update': f'🎬 Starting {duration}s video generation...'
        })

        # Prepare image URL - convert local image to base64 data URL for Fal AI
        if image_url.startswith('im_') and not image_url.startswith('http'):
            # Convert image_id to base64 data URL
            image_file_path = os.path.join(FILES_DIR, image_url)
            if not os.path.exists(image_file_path):
                raise ValueError(f"Image file not found: {image_url}")
            
            # Read image file and convert to base64 data URL
            import base64
            import mimetypes
            
            with open(image_file_path, 'rb') as image_file:
                image_data = image_file.read()
                
            # Determine MIME type
            mime_type, _ = mimetypes.guess_type(image_file_path)
            if not mime_type:
                # Default to JPEG if we can't determine the type
                mime_type = 'image/jpeg'
            
            # Create base64 data URL
            base64_data = base64.b64encode(image_data).decode('utf-8')
            full_image_url = f"data:{mime_type};base64,{base64_data}"
            print(f"🎬 Converted {image_url} to base64 data URL (length: {len(full_image_url)} chars)")
            
        else:
            full_image_url = image_url
            print(f"🎬 Using original image_url: {full_image_url}")

        # Create progress callback to send updates via WebSocket
        async def progress_callback(message: str):
            await broadcast_session_update(session_id, canvas_id, {
                'type': 'tool_call_progress',
                'tool_call_id': tool_call_id,
                'update': message  # Frontend expects 'update' field
            })

        # Generate video using the appropriate provider
        mime_type, filename, actual_duration = await generator.generate_video(
            prompt=prompt,
            image_url=full_image_url,
            duration=duration,
            progress_callback=progress_callback
        )

        file_id = generate_file_id()
        url = f'/api/file/{filename}'

        file_data = {
            'mimeType': mime_type,
            'id': file_id,
            'dataURL': url,
            'created': int(time.time() * 1000),
            'duration': actual_duration,
        }

        new_video_element = await generate_new_video_element(canvas_id, file_id, {
            'duration': actual_duration,
        })

        # Update the canvas data, add the new video element
        canvas_data = await db_service.get_canvas_data(canvas_id)
        if 'data' not in canvas_data:
            canvas_data['data'] = {}
        if 'elements' not in canvas_data['data']:
            canvas_data['data']['elements'] = []
        if 'files' not in canvas_data['data']:
            canvas_data['data']['files'] = {}

        canvas_data['data']['elements'].append(new_video_element)
        canvas_data['data']['files'][file_id] = file_data

        video_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"

        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data['data']))

        await broadcast_session_update(session_id, canvas_id, {
            'type': 'video_generated',
            'tool_call_id': tool_call_id,
            'element': new_video_element,
            'file': file_data,
            'video_url': video_url,
        })

        return f"Video generated successfully! Duration: {actual_duration}s ![video_id: {filename}]({video_url})"

    except Exception as e:
        print(f"Error generating video: {str(e)}")
        traceback.print_exc()
        await send_to_websocket(session_id, {
            'type': 'error',
            'tool_call_id': tool_call_id,
            'error': str(e)
        })
        return f"Video generation failed: {str(e)}"


async def generate_new_video_element(canvas_id: str, fileid: str, video_data: dict):
    """Generate a new video element for the canvas"""
    canvas = await db_service.get_canvas_data(canvas_id)
    canvas_data = canvas.get('data', {})
    elements = canvas_data.get('elements', [])

    # Find the last video element to position the new one
    last_x = 0
    last_y = 0
    last_width = 0
    last_height = 0
    video_elements = [
        element for element in elements if element.get('type') == 'video']
    last_video_element = video_elements[-1] if len(video_elements) > 0 else None
    
    if last_video_element is not None:
        last_x = last_video_element.get('x', 0)
        last_y = last_video_element.get('y', 0)
        last_width = last_video_element.get('width', 0)
        last_height = last_video_element.get('height', 0)

    new_x = last_x + last_width + 20

    # Default video dimensions (16:9 aspect ratio)
    video_width = 320
    video_height = 180

    return {
        'type': 'video',
        'id': fileid,
        'x': new_x,
        'y': last_y,
        'width': video_width,
        'height': video_height,
        'angle': 0,
        'fileId': fileid,
        'strokeColor': '#000000',
        'fillStyle': 'solid',
        'strokeStyle': 'solid',
        'boundElements': None,
        'roundness': None,
        'frameId': None,
        'backgroundColor': 'transparent',
        'strokeWidth': 1,
        'roughness': 0,
        'opacity': 100,
        'groupIds': [],
        'seed': int(random.random() * 1000000),
        'version': 1,
        'versionNonce': int(random.random() * 1000000),
        'isDeleted': False,
        'index': None,
        'updated': 0,
        'link': None,
        'locked': False,
        'status': 'saved',
        'scale': [1, 1],
        'crop': None,
        'duration': video_data.get('duration', 6),
    }

print('🎬', generate_video.args_schema.model_json_schema())