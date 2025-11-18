import os

DEFAULT_PORT = int(os.environ.get('DEFAULT_PORT', 57988))

def get_server_url():
    """Get the server URL from environment or use default localhost"""
    # Try environment variable first
    server_url = os.environ.get('SERVER_URL')
    if server_url and server_url.strip():  # Check for non-empty string
        print(f"🔗 Using SERVER_URL: {server_url}")
        return server_url.rstrip('/')
    
    # Default to localhost
    default_url = f"http://localhost:{DEFAULT_PORT}"
    print(f"🔗 Using default server URL: {default_url}")
    
    return default_url
