import json
import unittest
from unittest.mock import patch
import httpx
from fastapi.testclient import TestClient
import main


class ChatTest(unittest.TestCase):
    def test_response_and_no_health_data(self):
        real_client = httpx.AsyncClient
        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(str(request.url), 'https://api.deepseek.com/chat/completions')
            self.assertFalse(body['stream'])
            self.assertEqual(body['thinking']['type'], 'disabled')
            self.assertEqual(body['messages'][0]['role'], 'system')
            self.assertEqual(body['messages'][1:], [{'role': 'user', 'content': '你好'}, {'role': 'user', 'content': '喝水建议'}])
            self.assertNotIn('weight', body)
            return httpx.Response(200, json={'choices': [{'finish_reason': 'stop', 'message': {'content': '可以少量多次饮水。'}}]})
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'test-only'}), patch('ai_chat.httpx.AsyncClient', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)):
            client = TestClient(main.app)
            result = client.post('/api/chat', json={'message': '喝水建议', 'history': [{'role': 'user', 'content': '你好'}]})
            self.assertEqual(result.status_code, 200)
            self.assertEqual(result.json()['mode'], 'ai')
            self.assertEqual(result.json()['reply'], '可以少量多次饮水。')

    def test_upstream_error_is_sanitized(self):
        real_client = httpx.AsyncClient
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'test-only'}), patch('ai_chat.httpx.AsyncClient', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(lambda req: httpx.Response(401, text='secret upstream detail')), **kw)):
            result = TestClient(main.app).post('/api/chat', json={'message': '你好'})
            self.assertEqual(result.status_code, 502)
            self.assertNotIn('secret', result.text)
