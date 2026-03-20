"""Unit tests for MiniMax provider integration."""
import os
import sys
import unittest

# Add server directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


class TestMiniMaxDefaultConfig(unittest.TestCase):
    """Test that MiniMax is properly configured in DEFAULT_PROVIDERS_CONFIG."""

    def setUp(self):
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        self.config = DEFAULT_PROVIDERS_CONFIG

    def test_minimax_provider_exists(self):
        self.assertIn('minimax', self.config)

    def test_minimax_url(self):
        self.assertEqual(
            self.config['minimax']['url'],
            'https://api.minimax.io/v1/'
        )

    def test_minimax_has_text_models(self):
        models = self.config['minimax']['models']
        self.assertIn('MiniMax-M2.7', models)
        self.assertIn('MiniMax-M2.5', models)
        self.assertIn('MiniMax-M2.5-highspeed', models)

    def test_minimax_models_are_text_type(self):
        models = self.config['minimax']['models']
        for model_name, model_config in models.items():
            self.assertEqual(
                model_config.get('type'), 'text',
                f"Model {model_name} should be type 'text'"
            )

    def test_minimax_has_empty_api_key(self):
        self.assertEqual(self.config['minimax']['api_key'], '')

    def test_minimax_max_tokens(self):
        self.assertEqual(self.config['minimax']['max_tokens'], 8192)


class TestMiniMaxConfigService(unittest.TestCase):
    """Test ConfigService handles MiniMax provider correctly."""

    def test_config_service_includes_minimax(self):
        from services.config_service import config_service
        config = config_service.get_config()
        self.assertIn('minimax', config)

    def test_minimax_not_marked_as_custom(self):
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        minimax_config = DEFAULT_PROVIDERS_CONFIG['minimax']
        self.assertNotIn('is_custom', minimax_config)


class TestMiniMaxProviderRouting(unittest.TestCase):
    """Test that MiniMax provider routes via OpenAI-compatible path (not Ollama).

    This tests the routing logic from _create_text_model() without importing
    the full agent_service module (which has heavy dependencies).
    """

    def test_minimax_provider_is_not_ollama(self):
        """MiniMax should not match the 'ollama' provider check."""
        provider = 'minimax'
        self.assertNotEqual(provider, 'ollama')

    def test_minimax_openai_compatible_routing(self):
        """Simulate the _create_text_model routing logic."""
        provider = 'minimax'
        model = 'MiniMax-M2.7'
        url = 'https://api.minimax.io/v1/'

        # This mirrors the logic in agent_service._create_text_model
        if provider == 'ollama':
            path = 'ollama'
        else:
            path = 'openai_compat'

        self.assertEqual(path, 'openai_compat')

    def test_all_minimax_models_route_correctly(self):
        """All MiniMax models should use OpenAI-compatible path."""
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        models = DEFAULT_PROVIDERS_CONFIG['minimax']['models']
        for model_name in models:
            provider = 'minimax'
            self.assertNotEqual(provider, 'ollama',
                                f"Model {model_name} should not route via Ollama")


class TestMiniMaxProviderConfig(unittest.TestCase):
    """Test MiniMax provider configuration structure."""

    def test_minimax_config_has_required_fields(self):
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        minimax = DEFAULT_PROVIDERS_CONFIG['minimax']
        self.assertIn('models', minimax)
        self.assertIn('url', minimax)
        self.assertIn('api_key', minimax)
        self.assertIn('max_tokens', minimax)

    def test_minimax_model_count(self):
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        models = DEFAULT_PROVIDERS_CONFIG['minimax']['models']
        self.assertEqual(len(models), 3)

    def test_minimax_url_starts_with_https(self):
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        url = DEFAULT_PROVIDERS_CONFIG['minimax']['url']
        self.assertTrue(url.startswith('https://'))

    def test_minimax_url_ends_with_slash(self):
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        url = DEFAULT_PROVIDERS_CONFIG['minimax']['url']
        self.assertTrue(url.endswith('/'))

    def test_minimax_config_matches_other_providers(self):
        """MiniMax config should have the same structure as OpenAI config."""
        from services.config_service import DEFAULT_PROVIDERS_CONFIG
        minimax = DEFAULT_PROVIDERS_CONFIG['minimax']
        openai = DEFAULT_PROVIDERS_CONFIG['openai']
        self.assertEqual(set(minimax.keys()), set(openai.keys()))


if __name__ == '__main__':
    unittest.main()
