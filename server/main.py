import os
import sys
import io
from dotenv import load_dotenv
from log import get_logger

logger = get_logger(__name__)

# 加载 .env 文件
load_dotenv()
# Ensure stdout and stderr use utf-8 encoding to prevent emoji logs from crashing python server
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
logger.info('Importing websocket_router')
from routers.websocket_router import *  # DO NOT DELETE THIS LINE, OTHERWISE, WEBSOCKET WILL NOT WORK
logger.info('Importing routers')
from routers import config_router, image_router, root_router, workspace, canvas, ssl_test, chat_router, settings, tool_confirmation, templates_router, auth_router, billing_router, pages_router, invite_router
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import argparse
from contextlib import asynccontextmanager
from starlette.types import Scope
from starlette.responses import Response
import socketio # type: ignore
logger.info('Importing websocket_state')
from services.websocket_state import sio
logger.info('Importing websocket_service')
from services.websocket_service import broadcast_init_done
logger.info('Importing config_service')
from services.config_service import config_service
logger.info('Importing tool_service')
from services.tool_service import tool_service


async def initialize():
    logger.info('Initializing config_service')
    await config_service.initialize()
    logger.info('Initializing broadcast_init_done')
    await broadcast_init_done()

root_dir = os.path.dirname(__file__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # onstartup
    # TODO: Check if there will be racing conditions when user send chat request but tools and models are not initialized yet.
    await initialize()
    await tool_service.initialize()
    yield
    # onshutdown

logger.info('Creating FastAPI app')
app = FastAPI(
    lifespan=lifespan,
    # 设置请求体大小限制（50MB）
    # 注意：这个参数在较新版本的FastAPI中可能需要使用其他方式设置
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://www.magicart.cc",
        "https://magicart.cc", 
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174"
    ],  # 明确指定允许的来源
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 明确指定允许的HTTP方法
    allow_headers=["*"],  # 允许所有头部
)

# 添加文件大小检查中间件
@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """限制上传文件大小的中间件"""
    # 设置最大文件大小 (50MB)
    MAX_SIZE = 50 * 1024 * 1024  # 50MB in bytes
    
    if request.method == "POST":
        content_length = request.headers.get("content-length")
        if content_length:
            content_length = int(content_length)
            if content_length > MAX_SIZE:
                logger.warning(f"Request size {content_length} bytes exceeds limit {MAX_SIZE} bytes")
                raise HTTPException(
                    status_code=413, 
                    detail=f"Request entity too large. Maximum size is {MAX_SIZE // (1024*1024)}MB"
                )
    
    response = await call_next(request)
    return response

# Include routers
logger.info('Including routers')
app.include_router(config_router.router)
app.include_router(settings.router)
app.include_router(auth_router.router)
app.include_router(billing_router.router)
app.include_router(root_router.router)
app.include_router(canvas.router)
app.include_router(workspace.router)
app.include_router(image_router.router)
app.include_router(ssl_test.router)
app.include_router(chat_router.router)
app.include_router(tool_confirmation.router)
app.include_router(templates_router.router)
app.include_router(pages_router.router)
app.include_router(invite_router.router)

# Mount the React build directory
react_build_dir = os.environ.get('UI_DIST_DIR', os.path.join(
    os.path.dirname(root_dir), "react", "dist"))


# 无缓存静态文件类
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response


static_site = os.path.join(react_build_dir, "assets")
if os.path.exists(static_site):
    app.mount("/assets", NoCacheStaticFiles(directory=static_site), name="assets")

# Mount template images directory first (more specific path)
template_images_dir = os.path.join(root_dir, "static", "template_images")
if os.path.exists(template_images_dir):
    app.mount("/static/template_images", StaticFiles(directory=template_images_dir), name="template_images")

# Mount static files from React build directory with /static prefix (less specific path)
if os.path.exists(react_build_dir):
    app.mount("/static", StaticFiles(directory=react_build_dir), name="static")

# Add endpoint for static files at root level (PNG, SVG, etc.)
@app.get("/{filename:path}")
async def serve_static_files(filename: str):
    # Check if file exists in react build directory and is a static file
    if filename.endswith(('.png', '.svg', '.ico', '.jpg', '.jpeg', '.gif', '.webp', '.html')):
        file_path = os.path.join(react_build_dir, filename)
        if os.path.exists(file_path):
            return FileResponse(file_path)
    # If not found, serve the React app (SPA fallback)
    response = FileResponse(os.path.join(react_build_dir, "index.html"))
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response



logger.info('Creating socketio app')
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path='/socket.io')

if __name__ == "__main__":
    # bypass localhost request for proxy, fix ollama proxy issue
    _bypass = {"127.0.0.1", "localhost", "::1"}
    current = set(os.environ.get("no_proxy", "").split(",")) | set(
        os.environ.get("NO_PROXY", "").split(","))
    os.environ["no_proxy"] = os.environ["NO_PROXY"] = ",".join(
        sorted(_bypass | current - {""}))

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8000,
                        help='Port to run the server on')
    args = parser.parse_args()
    import uvicorn
    logger.info(f"🌟Starting server, UI_DIST_DIR: {os.environ.get('UI_DIST_DIR')}")

    uvicorn.run(socket_app, host="127.0.0.1", port=args.port)
