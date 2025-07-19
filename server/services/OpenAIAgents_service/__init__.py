# services/OpenAIAgents_service/__init__.py

from .magic_agent import create_magic_response
from .jaaz_magic_agent import create_jaaz_response

__all__ = [
    'create_magic_response',
    'create_jaaz_response'
]
