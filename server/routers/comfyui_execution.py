import json
import os
import sys
import time
import urllib.error
import urllib.parse
import uuid
from datetime import timedelta
import asyncio

import httpx
import websockets
import typer
from rich import print as pprint
from rich.progress import BarColumn, Column, Progress, Table, TimeElapsedColumn

from services.websocket_service import send_to_websocket

async def check_comfy_server_running(port, host, protocol="http"):
    async with httpx.AsyncClient(timeout=10) as client:
        url = f'{protocol}://{host}:{port}/api/prompt'
        response = await client.get(url)
        return response.status_code == 200

async def execute(workflow: dict, host, port, wait=True, verbose=False, local_paths=False, timeout=300, ctx: dict = {}, protocol="http"):
    if not await check_comfy_server_running(port, host, protocol=protocol):
        pprint(f"[bold red]ComfyUI not running on specified address ({host}:{port})[/bold red]")
        raise typer.Exit(code=1)

    progress = None
    start = time.time()
    if wait:
        pprint(f"Executing comfyui workflow")
        progress = ExecutionProgress()
        # Remove or comment out the line below to avoid starting the live display
        # progress.start()
    else:
        print(f"Queuing comfyui workflow")

    execution = WorkflowExecution(workflow, host, port, verbose, progress, local_paths, timeout, ctx=ctx, protocol=protocol)

    try:
        if wait:
            await execution.connect()
        await execution.queue()
        if wait:
            await execution.watch_execution()
            end = time.time()
            progress.stop()
            progress = None

            if len(execution.outputs) > 0:
                pprint("[bold green]\nOutputs:[/bold green]")

                for f in execution.outputs:
                    pprint(f)

            elapsed = timedelta(seconds=end - start)
            pprint(f"[bold green]\nWorkflow execution completed ({elapsed})[/bold green]")
        else:
            pprint("[bold green]Workflow queued[/bold green]")
    finally:
        if progress:
            progress.stop()
    return execution


class ExecutionProgress(Progress):
    def get_renderables(self):
        table_columns = (
            (Column(no_wrap=True) if isinstance(_column, str) else _column.get_table_column().copy())
            for _column in self.columns
        )

        for task in self.tasks:
            percent = "[progress.percentage]{task.percentage:>3.0f}%".format(task=task)
            if task.fields.get("progress_type") == "overall":
                overall_table = Table.grid(*table_columns, padding=(0, 1), expand=self.expand)
                overall_table.add_row(BarColumn().render(task), percent, TimeElapsedColumn().render(task))
                yield overall_table
            else:
                yield self.make_tasks_table([task])


class WorkflowExecution:
    def __init__(self, workflow, host, port, verbose, progress, local_paths, timeout=30, ctx: dict = {}, protocol="http"):
        self.workflow = workflow
        self.host = host
        self.port = port
        self.verbose = verbose
        self.local_paths = local_paths
        self.client_id = str(uuid.uuid4())
        self.outputs = []
        self.progress = progress
        self.remaining_nodes = set(self.workflow.keys())
        self.total_nodes = len(self.remaining_nodes)
        if progress:
            self.overall_task = self.progress.add_task("", total=self.total_nodes, progress_type="overall")
        self.current_node = None
        self.progress_task = None
        self.progress_node = None
        self.prompt_id = None
        self.ws = None
        self.timeout = timeout
        self.ctx = ctx
        self.protocol = protocol
        self.ws_protocol = "wss" if protocol == "https" else "ws"

    async def connect(self):
        self.ws = await websockets.connect(f"{self.ws_protocol}://{self.host}:{self.port}/ws?clientId={self.client_id}")

    async def queue(self):
        data = {"prompt": self.workflow, "client_id": self.client_id}
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(f"{self.protocol}://{self.host}:{self.port}/prompt", json=data)
                body = response.json()
                self.prompt_id = body["prompt_id"]
            except httpx.HTTPStatusError as e:
                message = "An unknown error occurred"
                if e.response.status_code == 500:
                    message = e.response.text
                elif e.response.status_code == 400:
                    body = e.response.json()
                    if body["node_errors"].keys():
                        message = json.dumps(body["node_errors"], indent=2)

                self.progress.stop()

                pprint(f"[bold red]Error running workflow\n{message}[/bold red]")
                await send_to_websocket(self.ctx.get('session_id'), {
                    'type': 'error',
                    'error': message
                })
                raise Exception(message)

    async def watch_execution(self):
        async for message in self.ws:
            if isinstance(message, str):
                message = json.loads(message)
                if not await self.on_message(message):
                    break

    def update_overall_progress(self):
        self.progress.update(self.overall_task, completed=self.total_nodes - len(self.remaining_nodes))

    def get_node_title(self, node_id):
        node = self.workflow[node_id]
        if "_meta" in node and "title" in node["_meta"]:
            return node["_meta"]["title"]
        return node["class_type"]

    def log_node(self, type, node_id):
        if not self.verbose:
            return

        node = self.workflow[node_id]
        class_type = node["class_type"]
        title = self.get_node_title(node_id)

        if title != class_type:
            title += f"[bright_black] - {class_type}[/]"
        title += f"[bright_black] ({node_id})[/]"

        pprint(f"{type} : {title}")

    def format_image_path(self, img):
        query = urllib.parse.urlencode(img)
        return f"{self.protocol}://{self.host}:{self.port}/view?{query}"

    async def on_message(self, message):
        data = message["data"] if "data" in message else {}
        if "prompt_id" not in data or data["prompt_id"] != self.prompt_id:
            return True

        if message["type"] == "executing":
            return await self.on_executing(data)
        elif message["type"] == "execution_cached":
            await self.on_cached(data)
        elif message["type"] == "progress":
            await self.on_progress(data)
        elif message["type"] == "executed":
            await self.on_executed(data)
        elif message["type"] == "execution_error":
            await self.on_error(data)

        return True

    async def on_executing(self, data):
        if self.progress_task:
            self.progress.remove_task(self.progress_task)
            self.progress_task = None

        if data["node"] is None:
            return False
        else:
            if self.current_node:
                self.remaining_nodes.discard(self.current_node)
                self.update_overall_progress()
            self.current_node = data["node"]
            self.log_node("Executing", data["node"])
            if self.ctx.get('session_id'):
                await send_to_websocket(self.ctx.get('session_id'), {
                    'type': 'tool_call_progress',
                    'tool_call_id': self.ctx.get('tool_call_id'),
                    'session_id': self.ctx.get('session_id'),
                    'update': f'Executing {self.get_node_title(data["node"])}'
                })
        return True

    async def on_cached(self, data):
        nodes = data["nodes"]
        for n in nodes:
            self.remaining_nodes.discard(n)
            self.log_node("Cached", n)
        self.update_overall_progress()

    async def on_progress(self, data):
        node = data["node"]
        if self.ctx.get('session_id'):
            await send_to_websocket(self.ctx.get('session_id'), {
                    'type': 'tool_call_progress',
                    'tool_call_id': self.ctx.get('tool_call_id'),
                    'session_id': self.ctx.get('session_id'),
                    'update': f'Executing {self.get_node_title(node)} {data["value"] / data["max"] * 100}%'
            })
        if self.progress_node != node:
            self.progress_node = node
            if self.progress_task:
                self.progress.remove_task(self.progress_task)

            self.progress_task = self.progress.add_task(
                self.get_node_title(node), total=data["max"], progress_type="node"
            )

        self.progress.update(self.progress_task, completed=data["value"])

    async def on_executed(self, data):
        self.remaining_nodes.discard(data["node"])
        self.update_overall_progress()

        if "output" not in data:
            return

        output = data["output"]

        if output is None or "images" not in output:
            return

        for img in output["images"]:
            self.outputs.append(self.format_image_path(img))
        await send_to_websocket(self.ctx.get('session_id'), {
            'type': 'tool_call_progress',
            'tool_call_id': self.ctx.get('tool_call_id'),
            'session_id': self.ctx.get('session_id'),
            'update': '' # clear the progress update section by send empty string
        })

    async def on_error(self, data):
        pprint(f"[bold red]Error running workflow\n{json.dumps(data, indent=2)}[/bold red]")
        await send_to_websocket(self.ctx.get('session_id'), {
            'type': 'error',
            'error': json.dumps(data, indent=2)
        })
        raise Exception(json.dumps(data, indent=2))
