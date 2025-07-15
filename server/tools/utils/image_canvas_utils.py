"""
Canvas-related utilities for image generation
Handles canvas operations, locking, and notifications
"""

import asyncio
import random
import time
import json
from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional, Union, cast
from nanoid import generate
from services.db_service import db_service
from services.websocket_service import broadcast_session_update
from services.websocket_service import send_to_websocket
from utils.canvas import find_next_best_element_position

def generate_file_id() -> str:
    """Generate unique file ID"""
    return 'im_' + generate(size=8)


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


async def generate_new_image_element(canvas_data: Dict[str, Any], fileid: str, image_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate new image element for canvas"""


    new_x, new_y = await find_next_best_element_position(canvas_data)

    return {
        "type": "image",
        "id": fileid,
        "x": new_x,
        "y": new_y,
        "width": image_data.get("width", 0),
        "height": image_data.get("height", 0),
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


async def save_image_to_canvas(session_id: str, canvas_id: str, filename: str, mime_type: str, width: int, height: int) -> str:
    """Save image to canvas with proper locking and positioning"""
    # Use lock to ensure atomicity of the save process
    async with canvas_lock_manager.lock_canvas(canvas_id):
        # Fetch canvas data once inside the lock
        canvas: Optional[Dict[str, Any]] = await db_service.get_canvas_data(canvas_id)
        if canvas is None:
            canvas = {'data': {}}
        canvas_data: Dict[str, Any] = canvas.get('data', {})

        # Ensure 'elements' and 'files' keys exist
        if 'elements' not in canvas_data:
            canvas_data['elements'] = []
        if 'files' not in canvas_data:
            canvas_data['files'] = {}

        file_id = generate_file_id()
        url = f'/api/file/{filename}'

        file_data: Dict[str, Any] = {
            'mimeType': mime_type,
            'id': file_id,
            'dataURL': url,
            'created': int(time.time() * 1000),
        }

        new_image_element: Dict[str, Any] = await generate_new_image_element(
            canvas_data,
            file_id,
            {
                'width': width,
                'height': height,
            })

        # Update the canvas data with the new element and file info
        elements_list = cast(List[Dict[str, Any]], canvas_data['elements'])
        elements_list.append(new_image_element)
        canvas_data['files'][file_id] = file_data

        image_url = f"/api/file/{filename}"

        # Save the updated canvas data back to the database
        await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data))

        # Broadcast image generation message to frontend
        await broadcast_session_update(session_id, canvas_id, {
            'type': 'image_generated',
            'element': new_image_element,
            'file': file_data,
            'image_url': image_url,
        })

        return image_url


async def send_image_start_notification(session_id: str, message: str) -> None:
    """Send image generation start notification"""
    await send_to_websocket(session_id, {
        'type': 'image_generation_start',
        'message': message
    })


async def send_image_error_notification(session_id: str, error_message: str) -> None:
    """Send image generation error notification"""
    await send_to_websocket(session_id, {
        'type': 'error',
        'error': error_message
    })
