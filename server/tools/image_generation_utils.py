import random
from services.db_service import db_service
from nanoid import generate
import time
import json
from common import DEFAULT_PORT
from services.websocket_service import broadcast_session_update


async def generate_new_image_element(canvas_id: str, fileid: str, image_data: dict):
    canvas = await db_service.get_canvas_data(canvas_id)
    canvas_data = canvas.get("data", {})
    elements = canvas_data.get("elements", [])

    # find the last image element
    last_x = 0
    last_y = 0
    last_width = 0
    last_height = 0
    image_elements = [element for element in elements if element.get("type") == "image"]
    last_image_element = image_elements[-1] if len(image_elements) > 0 else None
    if last_image_element is not None:
        last_x = last_image_element.get("x", 0)
        last_y = last_image_element.get("y", 0)
        last_width = last_image_element.get("width", 0)
        last_height = last_image_element.get("height", 0)

    new_x = last_x + last_width + 20

    return {
        "type": "image",
        "id": fileid,
        "x": new_x,
        "y": last_y,
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


async def generate_new_video_element(canvas_id: str, fileid: str, video_data: dict):
    canvas = await db_service.get_canvas_data(canvas_id)
    canvas_data = canvas.get("data", {})
    elements = canvas_data.get("elements", [])

    # find the last image element
    last_x = 0
    last_y = 0
    last_width = 0
    last_height = 0
    image_elements = [element for element in elements if element.get("type") == "image"]
    last_image_element = image_elements[-1] if len(image_elements) > 0 else None
    if last_image_element is not None:
        last_x = last_image_element.get("x", 0)
        last_y = last_image_element.get("y", 0)
        last_width = last_image_element.get("width", 0)
        last_height = last_image_element.get("height", 0)

    new_x = last_x + last_width + 20

    return {
        "type": "video",
        "id": fileid,
        "x": new_x,
        "y": last_y,
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


async def save_image_to_canvas(
    session_id: str,
    canvas_id: str,
    filename: str,
    mime_type: str,
    width: int,
    height: int,
):
    file_id = generate_file_id()
    url = f"/api/file/{filename}"

    file_data = {
        "mimeType": mime_type,
        "id": file_id,
        "dataURL": url,
        "created": int(time.time() * 1000),
    }

    new_image_element = await generate_new_image_element(
        canvas_id,
        file_id,
        {
            "width": width,
            "height": height,
        },
    )

    # update the canvas data, add the new image element
    canvas_data = await db_service.get_canvas_data(canvas_id)
    if "data" not in canvas_data:
        canvas_data["data"] = {}
    if "elements" not in canvas_data["data"]:
        canvas_data["data"]["elements"] = []
    if "files" not in canvas_data["data"]:
        canvas_data["data"]["files"] = {}

    canvas_data["data"]["elements"].append(new_image_element)
    canvas_data["data"]["files"][file_id] = file_data

    image_url = f"http://localhost:{DEFAULT_PORT}/api/file/{filename}"

    # print('🛠️canvas_data', canvas_data)

    await db_service.save_canvas_data(canvas_id, json.dumps(canvas_data["data"]))

    await broadcast_session_update(
        session_id,
        canvas_id,
        {
            "type": "image_generated",
            "element": new_image_element,
            "file": file_data,
            "image_url": image_url,
        },
    )
    return image_url


# 生成唯一文件 ID
def generate_file_id():
    return "im_" + generate(size=8)
