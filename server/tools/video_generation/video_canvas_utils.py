"""
Video canvas utilities module
Contains functions for video processing, canvas operations, and notifications
"""

import json
import time
import os
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Tuple, Optional, Union
from services.config_service import FILES_DIR
from services.db_service import db_service
from services.websocket_service import send_to_websocket, broadcast_session_update  # type: ignore
from common import DEFAULT_PORT
from utils.http_client import HttpClient
import aiofiles
import mimetypes
from pymediainfo import MediaInfo
from nanoid import generate
import random
from utils.canvas import find_next_best_element_position


class CanvasLockManager:
    """Canvas lock manager to prevent concurrent operations causing position overlap"""

    def __init__(self) -> None:
        self._locks: Dict[str, asyncio.Lock] = {}

    @asynccontextmanager
    async def lock_canvas(self, canvas_id: str):
        if canvas_id not in self._locks:
            self._locks[canvas_id] = asyncio.Lock()

        async with self._locks[canvas_id]:
            yield


# Global lock manager instance
canvas_lock_manager = CanvasLockManager()


async def save_video_to_canvas(
    session_id: str,
    canvas_id: str,
    video_url: str
) -> Tuple[str, Dict[str, Any], Dict[str, Any]]:
    """
    Download video, save to files, create canvas element and return data

    Args:
        session_id: Session ID for notifications
        canvas_id: Canvas ID to add video element
        video_url: URL to download video from

    Returns:
        Tuple of (filename, file_data, new_video_element)
    """
    # Use lock to ensure atomicity of the save process
    async with canvas_lock_manager.lock_canvas(canvas_id):
        # Generate unique video ID
        video_id = generate_video_file_id()

        # Download and save video
        print(f"🎥 Downloading video from: {video_url}")
        mime_type, width, height, extension = await get_video_info_and_save(
            video_url, os.path.join(FILES_DIR, f"{video_id}")
        )
        filename = f"{video_id}.{extension}"

        print(f"🎥 Video saved as: {filename}, dimensions: {width}x{height}")

        # Create file data
        file_id = generate_video_file_id()
        file_url = f"/api/file/{filename}"

        file_data: Dict[str, Any] = {
            "mimeType": mime_type,
            "id": file_id,
            "dataURL": file_url,
            "created": int(time.time() * 1000),
        }

        # Create new video element for canvas
        new_video_element: Dict[str, Any] = await generate_new_video_element(
            canvas_id,
            file_id,
            {
                "width": width,
                "height": height,
            },
        )

        # Update canvas data
        canvas_data: Optional[Dict[str, Any]] = await db_service.get_canvas_data(canvas_id)
        if canvas_data is None:
            canvas_data = {}
        if "data" not in canvas_data:
            canvas_data["data"] = {}
        if "elements" not in canvas_data["data"]:
            canvas_data["data"]["elements"] = []
        if "files" not in canvas_data["data"]:
            canvas_data["data"]["files"] = {}

        canvas_data["data"]["elements"].append(
            new_video_element)  # type: ignore
        canvas_data["data"]["files"][file_id] = file_data

        # Save updated canvas data
        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data["data"]))

        return filename, file_data, new_video_element


async def send_video_start_notification(session_id: str, message: str) -> None:
    """Send WebSocket notification about video generation start"""
    await send_to_websocket(session_id, {
        "type": "video_generation_started",
        "message": message
    })


async def send_video_completion_notification(
    session_id: str,
    canvas_id: str,
    new_video_element: Dict[str, Any],
    file_data: Dict[str, Any],
    video_url: str
) -> None:
    """Send WebSocket notification about video generation completion"""
    await broadcast_session_update(
        session_id,
        canvas_id,
        {
            "type": "video_generated",
            "element": new_video_element,
            "file": file_data,
            "video_url": video_url,
        },
    )


async def send_video_error_notification(session_id: str, error_message: str) -> None:
    """Send WebSocket notification about video generation error"""
    print(f"🎥 Video generation error: {error_message}")
    await send_to_websocket(session_id, {
        "type": "error",
        "error": error_message
    })


def format_video_success_message(filename: str) -> str:
    """Format success message for video generation"""
    return f"video generated successfully ![video_id: {filename}](http://localhost:{DEFAULT_PORT}/api/file/{filename})"


async def process_video_result(
    video_url: str,
    session_id: str,
    canvas_id: str,
    provider_name: str = ""
) -> str:
    """
    Complete video processing pipeline: save, update canvas, notify

    Args:
        video_url: URL of the generated video
        session_id: Session ID for notifications
        canvas_id: Canvas ID to add video element
        provider_name: Name of the provider (for logging)

    Returns:
        Success message with video link
    """
    try:
        # Save video to canvas and get file info
        filename, file_data, new_video_element = await save_video_to_canvas(
            session_id=session_id,
            canvas_id=canvas_id,
            video_url=video_url
        )

        # Send completion notification
        await send_video_completion_notification(
            session_id=session_id,
            canvas_id=canvas_id,
            new_video_element=new_video_element,
            file_data=file_data,
            video_url=file_data["dataURL"]
        )

        provider_info = f" using {provider_name}" if provider_name else ""
        print(f"🎥 Video generation completed{provider_info}: {filename}")
        return format_video_success_message(filename)

    except Exception as e:
        error_message = str(e)
        await send_video_error_notification(session_id, error_message)
        raise e


def generate_video_file_id() -> str:
    return "vi_" + generate(size=8)


async def get_video_info_and_save(
    url: str, file_path_without_extension: str
) -> Tuple[str, int, int, str]:
    # Fetch the video asynchronously
    async with HttpClient.create_aiohttp() as session:
        async with session.get(url) as response:
            video_content = await response.read()

    # Save to temporary mp4 file first
    temp_path = f"{file_path_without_extension}.mp4"
    async with aiofiles.open(temp_path, "wb") as out_file:
        await out_file.write(video_content)
    print("🎥 Video saved to", temp_path)

    try:
        media_info = MediaInfo.parse(temp_path)  # type: ignore
        width: int = 0
        height: int = 0

        for track in media_info.tracks:  # type: ignore
            if track.track_type == "Video":  # type: ignore
                width = int(track.width or 0)  # type: ignore
                height = int(track.height or 0)  # type: ignore
                print(f"Width: {width}, Height: {height}")
                break

        extension = "mp4"  # Default to mp4, can be flexible based on codec_name

        # Get mime type
        mime_type = mimetypes.types_map.get(".mp4", "video/mp4")

        print(
            f"🎥 Video info - width: {width}, height: {height}, mime_type: {mime_type}, extension: {extension}"
        )

        return mime_type, width, height, extension
    except Exception as e:
        print(f"Error probing video file {temp_path}: {str(e)}")
        raise e


async def generate_new_video_element(canvas_id: str, fileid: str, video_data: Dict[str, Any]) -> Dict[str, Any]:
    canvas: Optional[Dict[str, Any]] = await db_service.get_canvas_data(canvas_id)
    if canvas is None:
        canvas = {'data': {}}
    canvas_data: Dict[str, Any] = canvas.get("data", {})

    new_x, new_y = await find_next_best_element_position(canvas_data)

    return {
        "type": "video",
        "id": fileid,
        "x": new_x,
        "y": new_y,
        "width": video_data.get("width", 0),
        "height": video_data.get("height", 0),
        "angle": 0,
        "fileId": fileid,
        "strokeColor": "#000000",
        "fillStyle": "solid",
        "strokeStyle": "solid",
        "boundElements": None,
        "roundness": None,
        "frameId": None,
        "backgroundColor": "transparent",
        "strokeWidth": 1,
        "roughness": 0,
        "opacity": 100,
        "groupIds": [],
        "seed": int(random.random() * 1000000),
        "version": 1,
        "versionNonce": int(random.random() * 1000000),
        "isDeleted": False,
        "index": None,
        "updated": 0,
        "link": None,
        "locked": False,
        "status": "saved",
        "scale": [1, 1],
        "crop": None,
    }
