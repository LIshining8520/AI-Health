import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from lan_chat import app


class LanGatewayTest(unittest.TestCase):
    def test_auth_and_health_is_not_exposed(self):
        with patch('lan_chat.access_token', return_value='test-only'):
            client = TestClient(app)
            self.assertEqual(client.get('/api/ai/status').status_code, 401)
            headers = {'Authorization': 'Bearer test-only', 'Origin': 'capacitor://localhost'}
            response = client.get('/api/ai/status', headers=headers)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers['access-control-allow-origin'], 'capacitor://localhost')
            for path in ('/api/dashboard', '/api/apple-health', '/api/report/preview', '/docs'):
                self.assertEqual(client.get(path, headers=headers).status_code, 404)
            self.assertEqual(client.options('/api/chat', headers={'Origin': 'capacitor://localhost', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type'}).status_code, 200)
