import tempfile
from pathlib import Path
import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
import main


class ReportTest(unittest.TestCase):
    def test_preview_consent_binding_and_generation(self):
        original = main.DB_PATH
        try:
            with tempfile.TemporaryDirectory() as folder:
                main.DB_PATH = Path(folder) / 'test.sqlite3'
                client = TestClient(main.app)
                with patch('ai_chat.generate', new_callable=AsyncMock) as generate:
                    generate.return_value = {'reply': '今日健康报告', 'mode': 'ai'}
                    preview = client.get('/api/report/preview').json()
                    generate.assert_not_called()
                    self.assertIsNone(preview['data']['当天体重（kg）'])
                    self.assertEqual(client.post('/api/report', json={**preview, 'consent': False}).status_code, 422)
                    changed = {**preview, 'data': {**preview['data'], '步数（步，单一来源）': 99999}}
                    self.assertEqual(client.post('/api/report', json={**changed, 'consent': True}).status_code, 409)
                    generate.assert_not_called()
                    result = client.post('/api/report', json={**preview, 'consent': True})
                    self.assertEqual(result.status_code, 200)
                    generate.assert_awaited_once()
                    self.assertEqual(generate.call_args.args[1], [])
                    self.assertTrue(generate.call_args.kwargs['report'])
                    self.assertNotIn('records', generate.call_args.args[0])
        finally:
            main.DB_PATH = original

    def test_direct_analysis_uses_today_without_preview_confirmation(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo
        today = datetime.now(ZoneInfo('Asia/Shanghai')).date().isoformat()
        with patch('ai_chat.generate', new_callable=AsyncMock) as generate:
            generate.return_value = {'reply': '今日分析', 'mode': 'ai'}
            client = TestClient(main.app)
            result = client.post('/api/report/analyze', json={'message': '帮我分析今日健康数据', 'data': {'报告日期': today, '步数': 1234}})
            self.assertEqual(result.status_code, 200)
            self.assertIn('1234', generate.call_args.args[0])
            self.assertTrue(generate.call_args.kwargs['report'])
            generate.reset_mock()
            self.assertEqual(client.post('/api/report/analyze', json={'message': '分析', 'data': {'报告日期': '2000-01-01'}}).status_code, 409)
            generate.assert_not_called()
