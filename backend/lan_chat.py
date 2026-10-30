"""Authenticated LAN-only chat gateway. Does not expose health database endpoints."""
import hmac
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from main import DirectReportInput, chat, ai_status


def access_token():
    value = os.environ.get('LAN_CHAT_TOKEN', '')
    if not value:
        path = Path(__file__).with_name('.env')
        if path.exists():
            for line in path.read_text().splitlines():
                if line.startswith('LAN_CHAT_TOKEN='):
                    value = line.partition('=')[2].strip()
    return value


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware('http')
async def authorize(request: Request, call_next):
    expected = access_token()
    supplied = request.headers.get('authorization', '')
    if not expected or not hmac.compare_digest(supplied, 'Bearer ' + expected):
        return JSONResponse({'detail': '手机聊天连接验证失败，请更新测试版本。'}, status_code=401)
    return await call_next(request)


# Added last so CORS preflight is handled outside authentication middleware.
app.add_middleware(CORSMiddleware, allow_origins=['capacitor://localhost'], allow_methods=['GET', 'POST'], allow_headers=['Authorization', 'Content-Type'])
app.add_api_route('/api/chat', chat, methods=['POST'])
app.add_api_route('/api/ai/status', ai_status, methods=['GET'])


@app.post('/api/report/analyze')
async def phone_report(payload: DirectReportInput):
    from main import analyze_today
    return await analyze_today(payload, require_device_data=True)
