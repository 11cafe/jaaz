#!/usr/bin/env python3
"""
Test script to verify video canvas and chat functionality
"""
import requests
import json
import sqlite3
import os
import sys

# Configuration
BASE_URL = "http://localhost:57988"
CANVAS_ID = "xaLHgjjWumgBuEFAhrCSm"
DB_PATH = "/home/zdhpe/jaaz/server/user_data/localmanus.db"
VIDEO_FILE = "vid__28Xr6ru.mp4"

def test_server_running():
    """Test if the server is running"""
    try:
        response = requests.get(f"{BASE_URL}/api/list_models", timeout=5)
        print(f"✅ Server is running (status: {response.status_code})")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Server not running: {e}")
        return False

def test_video_file_exists():
    """Test if the video file exists"""
    video_path = f"/home/zdhpe/jaaz/server/user_data/files/{VIDEO_FILE}"
    if os.path.exists(video_path):
        size = os.path.getsize(video_path)
        print(f"✅ Video file exists: {VIDEO_FILE} ({size} bytes)")
        return True
    else:
        print(f"❌ Video file missing: {VIDEO_FILE}")
        return False

def test_video_served():
    """Test if video is being served by the API"""
    try:
        response = requests.get(f"{BASE_URL}/api/file/{VIDEO_FILE}", timeout=10)
        if response.status_code in [200, 206]:  # 206 for partial content
            print(f"✅ Video is served correctly (status: {response.status_code}, size: {len(response.content)} bytes)")
            return True
        else:
            print(f"❌ Video not served properly (status: {response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Error serving video: {e}")
        return False

def test_canvas_data():
    """Test canvas data in database"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Get canvas data
        cursor.execute('SELECT data FROM canvases WHERE id = ?', (CANVAS_ID,))
        result = cursor.fetchone()
        
        if not result:
            print(f"❌ Canvas not found: {CANVAS_ID}")
            return False
            
        data = json.loads(result[0])
        
        # Check elements
        elements = data.get('elements', [])
        video_elements = [e for e in elements if e.get('type') == 'video']
        
        print(f"📊 Canvas has {len(elements)} total elements")
        print(f"🎬 Canvas has {len(video_elements)} video elements")
        
        # Check files
        files = data.get('files', {})
        video_files = {k: v for k, v in files.items() if 'video' in v.get('mimeType', '')}
        
        print(f"📁 Canvas has {len(files)} total files")
        print(f"🎬 Canvas has {len(video_files)} video files")
        
        if video_elements and video_files:
            print("✅ Canvas has video elements and files")
            
            # Print video details
            for i, elem in enumerate(video_elements):
                print(f"   Video {i+1}: id={elem.get('id')}, position=({elem.get('x')}, {elem.get('y')}), size={elem.get('width')}x{elem.get('height')}")
            
            for file_id, file_data in video_files.items():
                print(f"   File {file_id}: url={file_data.get('dataURL')}, duration={file_data.get('duration')}s")
            
            return True
        else:
            print("❌ Canvas missing video elements or files")
            return False
            
    except Exception as e:
        print(f"❌ Database error: {e}")
        return False
    finally:
        if 'conn' in locals():
            conn.close()

def test_canvas_api():
    """Test canvas API endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/api/canvas/{CANVAS_ID}", timeout=10)
        if response.status_code == 200:
            data = response.json()
            canvas_data = data.get('data', {})
            
            elements = canvas_data.get('elements', [])
            files = canvas_data.get('files', {})
            
            video_elements = [e for e in elements if e.get('type') == 'video']
            video_files = {k: v for k, v in files.items() if 'video' in v.get('mimeType', '')}
            
            print(f"✅ Canvas API working (elements: {len(elements)}, files: {len(files)})")
            print(f"🎬 API returns {len(video_elements)} video elements, {len(video_files)} video files")
            
            return len(video_elements) > 0 and len(video_files) > 0
        else:
            print(f"❌ Canvas API error (status: {response.status_code})")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Canvas API request error: {e}")
        return False

def test_chat_session():
    """Test chat session API"""
    try:
        # First get canvas to find session
        response = requests.get(f"{BASE_URL}/api/canvas/{CANVAS_ID}", timeout=10)
        if response.status_code != 200:
            print(f"❌ Cannot get canvas for session test")
            return False
            
        canvas_data = response.json()
        sessions = canvas_data.get('sessions', [])
        
        if not sessions:
            print("❌ No chat sessions found")
            return False
            
        # Test the first session
        session_id = sessions[0]['id']
        print(f"🔍 Testing chat session: {session_id}")
        
        response = requests.get(f"{BASE_URL}/api/chat_session/{session_id}", timeout=10)
        if response.status_code == 200:
            messages = response.json()
            print(f"✅ Chat session API working ({len(messages)} messages)")
            
            # Check for video-related messages
            video_messages = [m for m in messages if 'video' in str(m).lower()]
            print(f"🎬 Found {len(video_messages)} video-related messages")
            
            return True
        else:
            print(f"❌ Chat session API error (status: {response.status_code})")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Chat session API error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 Testing Jaaz Video Canvas Functionality")
    print("=" * 50)
    
    tests = [
        ("Server Running", test_server_running),
        ("Video File Exists", test_video_file_exists),
        ("Video Served by API", test_video_served),
        ("Canvas Database Data", test_canvas_data),
        ("Canvas API", test_canvas_api),
        ("Chat Session API", test_chat_session),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n📋 {test_name}:")
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY:")
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"   {status}: {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 {passed}/{len(tests)} tests passed")
    
    if passed == len(tests):
        print("🎉 All tests passed! Video should work in canvas.")
    else:
        print("⚠️  Some tests failed. Check the issues above.")
        
    return passed == len(tests)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)