import os
import traceback
import platform
import subprocess
import mimetypes
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from services.config_service import USER_DATA_DIR
from typing import List, Dict, Any
import io

router = APIRouter(prefix="/api")

WORKSPACE_ROOT = os.path.join(USER_DATA_DIR, "workspace")

@router.post("/update_file")
async def update_file(request: Request):
    try:
        data = await request.json()
        path = data["path"]
        full_path = os.path.join(WORKSPACE_ROOT, path)
        content = data["content"]
        with open(full_path, "w") as f:
            f.write(content)
        return {"success": True}
    except Exception as e:
        return {"error": str(e), "path": path}

@router.post("/create_file")
async def create_file(request: Request):
    data = await request.json()
    rel_dir = data["rel_dir"]
    path = os.path.join(WORKSPACE_ROOT, rel_dir, 'Untitled.md')
    # Split the path into directory, filename, and extension
    dir_name, base_name = os.path.split(path)
    name, ext = os.path.splitext(base_name)

    candidate_path = path
    counter = 1
    while os.path.exists(candidate_path):
        # Generate new filename with incremented counter
        new_base = f"{name} {counter}{ext}"
        candidate_path = os.path.join(dir_name, new_base)
        counter += 1
    print('candidate_path', candidate_path)
    os.makedirs(os.path.dirname(candidate_path), exist_ok=True)
    with open(candidate_path, "w") as f:
        f.write("")
    return {"path": os.path.relpath(candidate_path, WORKSPACE_ROOT)}

@router.post("/delete_file")
async def delete_file(request: Request):
    data = await request.json()
    path = data["path"]
    os.remove(path)
    return {"success": True}

@router.post("/rename_file")
async def rename_file(request: Request):
    try:
        data = await request.json()
        old_path = data["old_path"]
        old_path = os.path.join(WORKSPACE_ROOT, old_path)
        new_title = data["new_title"]
        if os.path.exists(old_path):
            new_path = os.path.join(os.path.dirname(old_path), new_title)
            os.rename(old_path, new_path)
            return {"success": True, "path": new_path}
        else:
            return {"error": f"File {old_path} does not exist", "path": old_path}
    except Exception as e:
        traceback.print_exc()
        return {"error": str(e)}

@router.post("/read_file")
async def read_file(request: Request):
    try:
        data = await request.json()
        path = data["path"]
        full_path = os.path.join(WORKSPACE_ROOT, path)
        if os.path.exists(full_path):
            with open(full_path, "r") as f:
                content = f.read()
                return {"content": content}
        else:
            return {"error": f"File {path} does not exist", "path": path}
    except Exception as e:
        return {"error": str(e), "path": path}

@router.get("/list_files_in_dir")
async def list_files_in_dir(rel_path: str):
    try:
        full_path = os.path.join(WORKSPACE_ROOT, rel_path)
        files = os.listdir(full_path)
        file_nodes = []
        for file in files:
            file_path = os.path.join(full_path, file)
            file_nodes.append({
                "name": file,
                "is_dir": os.path.isdir(file_path),
                "rel_path": os.path.join(rel_path, file),
                "mtime": os.path.getmtime(file_path)  # Get modification time
            })
        # Sort by modification time in descending order
        file_nodes.sort(key=lambda x: x["mtime"], reverse=True)
        # Remove mtime from response as it was only used for sorting
        for node in file_nodes:
            node.pop("mtime")
        return file_nodes
    except Exception as e:
        return []

@router.post("/open_folder_in_explorer")
async def open_folder_in_explorer(request: Request):
    """
    在系统文件浏览器中打开指定文件夹
    
    Args:
        request: 包含文件夹路径的请求
    
    Returns:
        操作结果
    """
    try:
        data = await request.json()
        folder_path = data.get("path")
        
        if not folder_path:
            raise HTTPException(status_code=400, detail="Missing folder path")
        
        # 验证路径是否存在且为文件夹
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail="Folder not found")
        
        if not os.path.isdir(folder_path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        # 根据不同操作系统打开文件管理器
        system = platform.system()
        
        if system == "Windows":
            # Windows
            subprocess.run(["explorer", folder_path], check=True)
        elif system == "Darwin":
            # macOS
            subprocess.run(["open", folder_path], check=True)
        elif system == "Linux":
            # Linux
            subprocess.run(["xdg-open", folder_path], check=True)
        else:
            raise HTTPException(status_code=500, detail=f"Unsupported operating system: {system}")
        
        return {"success": True, "message": "Folder opened in system explorer"}
        
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error opening folder: {str(e)}")

@router.get("/browse_filesystem")
async def browse_filesystem(path: str = ""):
    """
    浏览电脑任意位置的文件系统
    
    Args:
        path: 要浏览的路径，如果为空则从用户家目录开始
    
    Returns:
        包含文件夹和文件信息的列表
    """
    try:
        # 如果path为空，从用户家目录开始
        if not path:
            path = os.path.expanduser("~")
        
        # 确保路径存在且可访问
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Path not found")
        
        if not os.path.isdir(path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        items = []
        
        try:
            # 获取目录下的所有项目
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                
                # 跳过隐藏文件（可选）
                if item.startswith('.'):
                    continue
                
                try:
                    stat = os.stat(item_path)
                    is_dir = os.path.isdir(item_path)
                    
                    # 获取文件类型
                    file_type = "folder" if is_dir else get_file_type(item_path)
                    
                    # 获取文件大小（仅对文件）
                    size = stat.st_size if not is_dir else None
                    
                    # 获取修改时间
                    mtime = stat.st_mtime
                    
                    # 检查是否是图片或视频文件
                    is_media = file_type in ["image", "video"]
                    
                    item_info = {
                        "name": item,
                        "path": item_path,
                        "type": file_type,
                        "size": size,
                        "mtime": mtime,
                        "is_directory": is_dir,
                        "is_media": is_media,
                        "has_thumbnail": is_media  # 可以生成缩略图
                    }
                    
                    items.append(item_info)
                    
                except (OSError, PermissionError):
                    # 跳过无法访问的文件
                    continue
                    
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # 按类型和名称排序：文件夹在前，然后按名称排序
        items.sort(key=lambda x: (not x["is_directory"], x["name"].lower()))
        
        return {
            "current_path": path,
            "parent_path": os.path.dirname(path) if path != os.path.dirname(path) else None,
            "items": items
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get_media_files")
async def get_media_files(path: str):
    """
    获取指定文件夹下的所有媒体文件（图片和视频）
    
    Args:
        path: 文件夹路径
    
    Returns:
        媒体文件列表
    """
    try:
        if not os.path.exists(path) or not os.path.isdir(path):
            raise HTTPException(status_code=400, detail="Invalid directory path")
        
        media_files = []
        
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                
                if os.path.isfile(item_path):
                    file_type = get_file_type(item_path)
                    
                    if file_type in ["image", "video"]:
                        stat = os.stat(item_path)
                        
                        media_files.append({
                            "name": item,
                            "path": item_path,
                            "type": file_type,
                            "size": stat.st_size,
                            "mtime": stat.st_mtime
                        })
                        
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
        
        # 按修改时间排序
        media_files.sort(key=lambda x: x["mtime"], reverse=True)
        
        return media_files
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get_file_thumbnail")
async def get_file_thumbnail(file_path: str):
    """
    获取文件的缩略图信息
    
    Args:
        file_path: 文件路径
    
    Returns:
        缩略图信息或文件信息
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        file_type = get_file_type(file_path)
        
        return {
            "path": file_path,
            "type": file_type,
            "exists": True,
            "can_preview": file_type in ["image", "video"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_file_type(file_path: str) -> str:
    """
    根据文件扩展名判断文件类型
    
    Args:
        file_path: 文件路径
    
    Returns:
        文件类型: 'image', 'video', 'audio', 'document', 'archive', 'code', 'file'
    """
    if os.path.isdir(file_path):
        return "folder"
    
    _, ext = os.path.splitext(file_path.lower())
    
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico'}
    video_extensions = {'.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.3gp'}
    audio_extensions = {'.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'}
    document_extensions = {'.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt', '.pages'}
    archive_extensions = {'.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'}
    code_extensions = {'.py', '.js', '.html', '.css', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs'}
    
    if ext in image_extensions:
        return "image"
    elif ext in video_extensions:
        return "video"
    elif ext in audio_extensions:
        return "audio"
    elif ext in document_extensions:
        return "document"
    elif ext in archive_extensions:
        return "archive"
    elif ext in code_extensions:
        return "code"
    else:
        return "file"

@router.get("/serve_file")
async def serve_file(file_path: str):
    """
    提供文件内容服务，用于在浏览器中预览图片和视频
    
    Args:
        file_path: 文件路径
    
    Returns:
        文件内容
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        # 检查文件类型
        file_type = get_file_type(file_path)
        if file_type not in ["image", "video"]:
            raise HTTPException(status_code=400, detail="File type not supported for preview")
        
        # 获取MIME类型
        mime_type, _ = mimetypes.guess_type(file_path)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        return FileResponse(
            file_path,
            media_type=mime_type,
            filename=os.path.basename(file_path)
        )
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get_file_info")
async def get_file_info(file_path: str):
    """
    获取文件详细信息
    
    Args:
        file_path: 文件路径
    
    Returns:
        文件详细信息
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
        
        stat = os.stat(file_path)
        file_type = get_file_type(file_path)
        
        return {
            "name": os.path.basename(file_path),
            "path": file_path,
            "type": file_type,
            "size": stat.st_size,
            "mtime": stat.st_mtime,
            "ctime": stat.st_ctime,
            "is_directory": os.path.isdir(file_path),
            "is_media": file_type in ["image", "video"],
            "mime_type": mimetypes.guess_type(file_path)[0] or "application/octet-stream"
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))