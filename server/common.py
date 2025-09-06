import os

DEFAULT_PORT = int(os.environ.get('DEFAULT_PORT', 8000))
BASE_URL = os.environ.get('BASE_URL', f'http://localhost:{DEFAULT_PORT}')
