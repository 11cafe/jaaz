#!/usr/bin/env python3
"""
Simple FastAPI app to test templates router without all dependencies
"""
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from routers.templates_router import router
import uvicorn

app = FastAPI()
app.include_router(router)

# Mount template images directory
root_dir = os.path.dirname(__file__)
template_images_dir = os.path.join(root_dir, "static", "template_images")
if os.path.exists(template_images_dir):
    app.mount("/static/template_images", StaticFiles(directory=template_images_dir), name="template_images")
    print(f"Mounted static files from: {template_images_dir}")
else:
    print(f"Warning: Template images directory not found: {template_images_dir}")

if __name__ == "__main__":
    print("Starting test server for templates...")
    uvicorn.run(app, host="127.0.0.1", port=57988)