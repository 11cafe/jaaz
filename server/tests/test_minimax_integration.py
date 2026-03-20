"""Integration tests for MiniMax provider.

These tests verify actual MiniMax API connectivity.
Requires MINIMAX_API_KEY environment variable to be set.
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

MINIMAX_API_KEY = os.environ.get('MINIMAX_API_KEY', '')


@unittest.skipUnless(MINIMAX_API_KEY, 'MINIMAX_API_KEY not set')
class TestMiniMaxAPIIntegration(unittest.TestCase):
    """Integration tests that call the real MiniMax API."""

    def test_minimax_chat_completion(self):
        """Test basic chat completion via OpenAI-compatible API."""
        from openai import OpenAI

        client = OpenAI(
            api_key=MINIMAX_API_KEY,
            base_url='https://api.minimax.io/v1/',
        )
        response = client.chat.completions.create(
            model='MiniMax-M2.5-highspeed',
            messages=[{'role': 'user', 'content': 'Say hello in one word.'}],
            max_tokens=10,
            temperature=0,
        )
        self.assertIsNotNone(response.choices)
        self.assertGreater(len(response.choices), 0)
        self.assertIsNotNone(response.choices[0].message.content)

    def test_minimax_model_list(self):
        """Test that MiniMax models are accessible."""
        from openai import OpenAI

        client = OpenAI(
            api_key=MINIMAX_API_KEY,
            base_url='https://api.minimax.io/v1/',
        )
        # Verify the API endpoint responds
        response = client.chat.completions.create(
            model='MiniMax-M2.5-highspeed',
            messages=[{'role': 'user', 'content': 'Hi'}],
            max_tokens=5,
            temperature=0,
        )
        self.assertEqual(response.model, 'MiniMax-M2.5-highspeed')

    def test_minimax_streaming(self):
        """Test streaming chat completion."""
        from openai import OpenAI

        client = OpenAI(
            api_key=MINIMAX_API_KEY,
            base_url='https://api.minimax.io/v1/',
        )
        stream = client.chat.completions.create(
            model='MiniMax-M2.5-highspeed',
            messages=[{'role': 'user', 'content': 'Say hi.'}],
            max_tokens=10,
            temperature=0,
            stream=True,
        )
        chunks = list(stream)
        self.assertGreater(len(chunks), 0)


if __name__ == '__main__':
    unittest.main()
