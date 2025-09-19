# services/OpenAIAgents_service/__init__.py

from .jaaz_magic_agent import create_jaaz_response
from .local_magic_agent import create_local_magic_response

__all__ = ['create_jaaz_response','create_local_magic_response']
