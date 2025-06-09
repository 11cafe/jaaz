from routers import config, agent, workspace, image_tools, canvas, ssl_test, settings
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
import asyncio
import os
import sys
import io
import argparse
from contextlib import asynccontextmanager

root_dir = os.path.dirname(__file__)

# Ensure stdout and stderr use utf-8 encoding to prevent emoji logs from crashing python server
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # onstartup
    await agent.initialize()
    yield
    # onshutdown

app = FastAPI(lifespan=lifespan)

# Include routers
app.include_router(config.router)
app.include_router(settings.router)
app.include_router(agent.router)
app.include_router(agent.wsrouter)
app.include_router(canvas.router)
app.include_router(workspace.router)
app.include_router(image_tools.router)
app.include_router(ssl_test.router)

# Mount the React build directory
react_build_dir = os.environ.get('UI_DIST_DIR', os.path.join(
    os.path.dirname(root_dir), "react", "dist"))

static_site = os.path.join(react_build_dir, "assets")
if os.path.exists(static_site):
    app.mount("/assets", StaticFiles(directory=static_site), name="assets")


@app.get("/")
async def serve_react_app():
    return FileResponse(os.path.join(react_build_dir, "index.html"))


if __name__ == "__main__":
    # bypas localhost request for proxy, fix ollama proxy issue
    _bypass = {"127.0.0.1", "localhost", "::1"}
    current = set(os.environ.get("no_proxy", "").split(",")) | set(
        os.environ.get("NO_PROXY", "").split(","))
    os.environ["no_proxy"] = os.environ["NO_PROXY"] = ",".join(
        sorted(_bypass | current - {""}))

    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=57988,
                        help='Port to run the server on')
    args = parser.parse_args()
    import uvicorn
    print("🌟Starting server, UI_DIST_DIR:", os.environ.get('UI_DIST_DIR'))
    uvicorn.run(app, host="127.0.0.1", port=args.port)
