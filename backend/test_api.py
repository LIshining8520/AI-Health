"""Run with: python -m unittest test_api.py"""
from pathlib import Path
import tempfile
import unittest
from fastapi.testclient import TestClient


class LocalPrototypeTest(unittest.TestCase):
    def test_record_roundtrip_and_validation(self):
        with tempfile.TemporaryDirectory() as folder:
            import main
            main.DB_PATH = Path(folder) / 'test.sqlite3'
            client = TestClient(main.app)
            self.assertEqual(client.get('/api/health').json()['status'], 'ok')
            self.assertEqual(client.post('/api/records', json={'kind': 'weight', 'value': -1}).status_code, 422)
            self.assertEqual(client.post('/api/records', json={'kind': 'weight', 'value': 501}).status_code, 422)
            self.assertEqual(client.post('/api/records', json={'kind': 'unknown', 'value': 1}).status_code, 422)
            response = client.post('/api/records', json={'kind': 'weight', 'value': 61.8})
            self.assertEqual(response.status_code, 201)
            self.assertEqual(client.get('/api/dashboard').json()['weight'], 61.8)
            self.assertEqual(client.post('/api/records', json={'kind': 'water', 'value': 250}).json()['water'], 1550)
            self.assertEqual(len(client.get('/api/dashboard').json()['records']), 2)
            from unittest.mock import patch
            with patch.dict('os.environ', {'DEEPSEEK_API_KEY': ''}):
                self.assertEqual(client.post('/api/chat', json={'message': '睡眠'}).status_code, 503)
            self.assertEqual(client.post('/api/chat', json={'message': '   '}).status_code, 422)

    def test_imported_weight_and_new_manual_record(self):
        import json
        import main
        original = main.DB_PATH
        try:
            with tempfile.TemporaryDirectory() as folder:
                main.DB_PATH = Path(folder) / 'test.sqlite3'
                client = TestClient(main.app)
                client.post('/api/records', json={'kind': 'weight', 'value': 61.8})
                snapshot = {'importedAt': '2099-01-01T00:00:00+08:00', 'days': [
                    {'date': '2026-10-10', 'weightKg': 62.8},
                    {'date': '2026-10-14', 'weightKg': 66.3},
                    {'date': '2026-10-15', 'weightKg': None}]}
                path = Path(folder) / 'apple-health.json'
                path.write_text(json.dumps(snapshot))
                data = client.get('/api/dashboard').json()
                self.assertEqual(data['weight'], 66.3)
                self.assertEqual(len(data['weightHistory']), 2)
                self.assertEqual(data['weightHistory'][-1]['date'], '2026-10-14')
                snapshot['importedAt'] = '2020-01-01T00:00:00+08:00'
                path.write_text(json.dumps(snapshot))
                data = client.post('/api/records', json={'kind': 'weight', 'value': 67.2}).json()
                self.assertEqual(data['weight'], 67.2)
                self.assertEqual(data['weightHistory'][-1]['source'], '手动记录')
        finally:
            main.DB_PATH = original

    def test_calendar_day_isolation(self):
        import json
        import main
        original = main.DB_PATH
        try:
            with tempfile.TemporaryDirectory() as folder:
                main.DB_PATH = Path(folder) / 'test.sqlite3'
                (Path(folder) / 'apple-health.json').write_text(json.dumps({'days': [
                    {'date': '2026-10-28', 'weightKg': 65, 'heartRate': 70, 'hrvHistory': [{'at': '2026-10-28T18:00:00+08:00', 'value': 60}], 'hrv': {'value': 60, 'average': 50, 'at': '2026-10-28T18:00:00+08:00'}, 'steps': 2000, 'sleepHours': 7},
                    {'date': '2026-10-29', 'heartRate': 100, 'steps': 5000}]}))
                client = TestClient(main.app)
                first = client.get('/api/dashboard?date=2026-10-28').json()
                second = client.get('/api/dashboard?date=2026-10-29').json()
                empty = client.get('/api/dashboard?date=2026-10-27').json()
                self.assertEqual(first['heartRate']['value'], 70)
                self.assertEqual(first['sleep']['hours'], 7)
                self.assertEqual(first['hrvHistory'], [{'at': '2026-10-28T18:00:00+08:00', 'value': 60}])
                self.assertEqual(second['hrvHistory'], [])
                self.assertEqual(empty['hrvHistory'], [])
                self.assertIsNone(second['hrv'])
                self.assertEqual(second['steps'], 5000)
                self.assertIsNone(second['weight'])
                self.assertIsNone(second['sleep'])
                self.assertIsNone(empty['heartRate'])
                self.assertEqual(empty['water'], 0)
                self.assertEqual(client.get('/api/dashboard?date=not-a-date').status_code, 422)
        finally:
            main.DB_PATH = original


if __name__ == '__main__':
    unittest.main()
