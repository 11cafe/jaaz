"""
Dynamic registration of ComfyUI workflows as LangChain tools.

Importing this module will:
1. Query the local database for all stored ComfyUI workflows.
2. For each workflow, generate:
   • A Pydantic input schema reflecting its `inputs` definition.
   • An async LangChain `@tool` function that forwards the call to
     `db_service.run_comfy_workflow(...)`.
3. Expose all generated tool callables in `DYNAMIC_COMFY_TOOLS`
   so the agent can do:

       from server.tools.comfy_dynamic import DYNAMIC_COMFY_TOOLS
       tools = [..., *DYNAMIC_COMFY_TOOLS]

If `run_comfy_workflow` is not yet implemented it will still work
(actually return a stub dict) so callers won't crash.
"""

from __future__ import annotations

import json
import os
import random
import time
import traceback
from io import BytesIO
from typing import Annotated, Any, Dict, List, Optional
from common import DEFAULT_PORT, get_server_url
from .utils.image_canvas_utils import (
    generate_file_id,
    generate_new_image_element,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolCallId, tool, BaseTool
from pydantic import BaseModel, Field, create_model
from routers.comfyui_execution import upload_image
from services.config_service import FILES_DIR, config_service, IMAGE_FORMATS
from services.db_service import db_service
from services.websocket_service import broadcast_session_update, send_to_websocket

from .utils.comfyui import ComfyUIWorkflowRunner
from tools.video_generation.video_canvas_utils import generate_new_video_element


def _python_type(param_type: str, default: Any):
    """Map simple param types to Python types."""
    if param_type == "number":
        # choose int vs float based on default value presence
        if isinstance(default, int):
            return int
        return float
    if param_type == "boolean" or param_type == "bool":
        return bool
    # Treat unknown / string / image / file / path all as str
    return str


def _build_input_schema(wf: Dict[str, Any]) -> type[BaseModel]:
    """
    Build a Pydantic model named '<WorkflowName>Input' from workflow['inputs'].
    The `inputs` column is stored in DB as JSON text -> parse first.
    """
    try:
        input_defs: List[Dict[str, Any]] = (
            wf["inputs"] if isinstance(wf["inputs"], list) else json.loads(wf["inputs"])
        )
    except Exception:
        # fall back to empty model if bad schema
        input_defs = []

    fields: Dict[str, tuple] = {}
    for param in input_defs:
        name = param.get("name")
        if not name:
            continue
        py_t = _python_type(param.get("type"), param.get("default_value"))
        default_val = param.get("default_value")
        desc = param.get("description", "")
        is_required = param.get("required", False)

        if is_required:
            desc = f"Required. {desc}"
            fields[name] = (py_t, Field(description=desc))
        else:
            desc = f"Optional. {desc}"
            fields[name] = (
                Optional[py_t],
                Field(default=default_val, description=desc),
            )
    # add a tool_call_id - fix the field definition format
    fields["tool_call_id"] = (
        Annotated[str, InjectedToolCallId],
        Field(description="Tool call identifier"),
    )

    model_name = f"{wf['name'].title().replace(' ', '')}InputSchema"
    return create_model(model_name, __base__=BaseModel, **fields)


def build_tool(wf: Dict[str, Any]) -> BaseTool:
    """Return an @tool function for the given workflow record."""
    input_schema = _build_input_schema(wf)

    @tool(
        wf["name"],
        description=wf.get("description") or f"Run ComfyUI workflow {wf['id']}",
        args_schema=input_schema,
    )
    async def _run(
        config: RunnableConfig,
        tool_call_id: Annotated[str, InjectedToolCallId],
        **kwargs,
    ) -> str:
        """
        code to call comfyui generating image.
        """
        print("🛠️ tool_call_id", tool_call_id)
        ctx = config.get("configurable", {})
        canvas_id = ctx.get("canvas_id", "")
        session_id = ctx.get("session_id", "")
        print("🛠️canvas_id", canvas_id, "session_id", session_id)
        # Inject the tool call id into the context
        ctx["tool_call_id"] = tool_call_id
        api_url = str(
            config_service.app_config.get("comfyui", {}).get("url", "")
        ).rstrip("/")

        # if there's image, upload it!
        # First, let's filter all values endswith .jpg .png etc

        required_data = dict(kwargs)
        for key, value in required_data.items():
            if isinstance(value, str) and value.lower().endswith(IMAGE_FORMATS):
                # Image!
                # Extract filename from potential API path like "/api/file/filename.png"
                if "/" in value:
                    filename = value.split("/")[
                        -1
                    ]  # Get the last part after the last "/"
                else:
                    filename = value
                image_path = os.path.join(FILES_DIR, filename)
                if not os.path.exists(image_path):
                    continue
                with open(image_path, "rb") as image_file:
                    image_bytes = image_file.read()
                image_stream = BytesIO(image_bytes)
                image_name = await upload_image(image_stream, api_url, filename)
                required_data[key] = image_name

        workflow_dict = await db_service.get_comfy_workflow(wf["id"])

        try:
            input_defs: List[Dict[str, Any]] = (
                wf["inputs"]
                if isinstance(wf["inputs"], list)
                else json.loads(wf["inputs"])
            )
        except Exception:
            input_defs = []

        for param in input_defs:
            param_name = param.get("name")
            node_id = param.get("node_id")
            node_input_name = param.get("node_input_name")

            if not (param_name and node_id and node_input_name):
                continue

            if param_name in required_data:
                value = required_data[param_name]
                if node_id in workflow_dict:
                    node_inputs = workflow_dict[node_id].get("inputs", {})
                    if node_input_name in node_inputs:
                        node_inputs[node_input_name] = value

        # Process seed if has seed
        # 改为直接遍历节点输入检测seed字段，替代字符串匹配
        seed_nodes = []
        for node_id, node in workflow_dict.items():
            if "seed" in node.get("inputs", {}):  # 直接检查节点输入是否有seed字段
                seed_nodes.append(node_id)  # 收集所有含seed的节点，不移除break

        if len(seed_nodes) > 0:  # 仅在存在种子节点时执行
            for node_id in seed_nodes:
                # 使用更大的随机范围（0到2^32-1更符合常见种子范围）
                workflow_dict[node_id]["inputs"]["seed"] = random.randint(
                    1, (1 << 32) - 1
                )

        try:
            generator = ComfyUIWorkflowRunner(workflow_dict, api_url)
            extra_kwargs = {}
            extra_kwargs["ctx"] = ctx

            outputs = await generator.generate(**extra_kwargs)
            # if outputs is not a list of list, make it a list of list
            if not isinstance(outputs, list) or (
                outputs and not isinstance(outputs[0], (list, tuple))
            ):
                outputs = [outputs]

            # update the canvas data, add the new image element
            canvas_data = await db_service.get_canvas_data(canvas_id)
            if "data" not in canvas_data:
                canvas_data["data"] = {}
            if "elements" not in canvas_data["data"]:
                canvas_data["data"]["elements"] = []
            if "files" not in canvas_data["data"]:
                canvas_data["data"]["files"] = {}

            generated_files_info = []

            for output in outputs:
                mime_type, width, height, filename = output
                file_id = generate_file_id()

                url = f"/api/file/{filename}"

                file_data = {
                    "mimeType": mime_type,
                    "id": file_id,
                    "dataURL": url,
                    "created": int(time.time() * 1000),
                }

                # Pass the current canvas_data to the element generation function
                if mime_type.startswith("image"):
                    new_element = await generate_new_image_element(
                        canvas_id,
                        file_id,
                        {
                            "width": width,
                            "height": height,
                        },
                        canvas_data=canvas_data.get("data", {}),
                    )
                else:
                    new_element = await generate_new_video_element(
                        canvas_id,
                        file_id,
                        {
                            "width": width,
                            "height": height,
                        },
                        canvas_data=canvas_data.get("data", {}),
                    )

                canvas_data["data"]["elements"].append(new_element)
                canvas_data["data"]["files"][file_id] = file_data

                image_url = f"{get_server_url()}/api/file/{filename}"

                generated_files_info.append(
                    {
                        "element": new_element,
                        "file": file_data,
                        "url": image_url,
                        "mime_type": mime_type,
                        "filename": filename,
                    }
                )

            await db_service.save_canvas_data(
                canvas_id, json.dumps(canvas_data["data"])
            )

            for file_info in generated_files_info:
                if file_info["mime_type"].startswith("image"):
                    await broadcast_session_update(
                        session_id,
                        canvas_id,
                        {
                            "type": "image_generated",
                            "element": file_info["element"],
                            "file": file_info["file"],
                            "image_url": file_info["url"],
                        },
                    )
                else:
                    await broadcast_session_update(
                        session_id,
                        canvas_id,
                        {
                            "type": "video_generated",
                            "element": file_info["element"],
                            "file": file_info["file"],
                            "video_url": file_info["url"],
                        },
                    )

            # Create a markdown string for all the generated files
            markdown_images = []
            for file_info in generated_files_info:
                markdown_images.append(
                    f"![id: {file_info['filename']}]({file_info['url']})"
                )

            return f"workflow executed successfully {', '.join(markdown_images)}"

        except Exception as e:
            print(f"Error generating image: {str(e)}")
            traceback.print_exc()
            await send_to_websocket(session_id, {"type": "error", "error": str(e)})
            return f"image generation failed: {str(e)}"

    return _run
