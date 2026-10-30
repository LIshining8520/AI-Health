import base64
import io
import json
import unittest
import zipfile
from unittest.mock import patch
import httpx
import pymupdf
from fastapi import HTTPException
from fastapi.testclient import TestClient
from chat_attachments import Attachment, attachment_parts
import main

def attachment(name, raw):
    return Attachment(name=name, data=base64.b64encode(raw).decode())

class AttachmentTests(unittest.TestCase):
    def test_text_word_pdf_image(self):
        text = attachment('folder/readme.txt', '冷酸宁附件测试'.encode())
        word = io.BytesIO()
        with zipfile.ZipFile(word, 'w') as z:
            z.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Word test 7391</w:t></w:r></w:p></w:body></w:document>')
        with pymupdf.open() as pdf:
            page = pdf.new_page()
            page.insert_text((72, 72), 'PDF test 4286')
            image = page.get_pixmap().tobytes('png')
            raw_pdf = pdf.tobytes()
        parts = attachment_parts([text, attachment('test.docx', word.getvalue()), attachment('test.pdf', raw_pdf), attachment('image.png', image)])
        combined = '\n'.join(p.get('text', '') for p in parts)
        self.assertIn('冷酸宁附件测试', combined)
        self.assertIn('Word test 7391', combined)
        self.assertIn('PDF test 4286', combined)
        self.assertEqual(sum(p['type'] == 'image_url' for p in parts), 2)

    def test_reject_invalid_and_overflow(self):
        for item in [Attachment(name='x.txt', data='***'), attachment('../x.txt', b'ok'), attachment('x.png', b'not an image'), attachment('x.exe', b'bin'), attachment('x.pdf', b'not pdf')]:
            with self.assertRaises(HTTPException): attachment_parts([item])
        with self.assertRaises(HTTPException): attachment_parts([attachment('large.txt', b'x' * 2_500_001)])
        with pymupdf.open() as pdf:
            for _ in range(13): pdf.new_page()
            with self.assertRaises(HTTPException): attachment_parts([attachment('large.pdf', pdf.tobytes())])

    def test_ai_receives_attachment_and_history(self):
        real_client = httpx.AsyncClient
        def handler(request):
            body = json.loads(request.content)
            self.assertEqual(body['model'], 'deepseek-flash')
            self.assertIn('previous file', json.dumps(body['messages'], ensure_ascii=False))
            self.assertIn('current file', json.dumps(body['messages'], ensure_ascii=False))
            return httpx.Response(200, json={'choices':[{'finish_reason':'stop','message':{'content':'附件已解析'}}]})
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY':'test-only'}), patch('ai_chat.httpx.AsyncClient', side_effect=lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw)):
            result = TestClient(main.app).post('/api/chat', json={'message':'分析附件', 'attachments':[attachment('new.txt', b'current file').model_dump()], 'history':[{'role':'user','content':'previous','attachments':[attachment('old.txt', b'previous file').model_dump()]}]})
            self.assertEqual(result.status_code, 200, result.text)
            self.assertEqual(result.json()['reply'], '附件已解析')

if __name__ == '__main__': unittest.main()
