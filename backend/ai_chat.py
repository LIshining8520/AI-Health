"""Server-only DeepSeek Chat Completions integration; no health database access."""
import os
from pathlib import Path
import httpx
from fastapi import HTTPException


def settings():
    values = {}
    path = Path(__file__).with_name('.env')
    if path.exists():
        for line in path.read_text(encoding='utf-8').splitlines():
            key, sep, value = line.strip().partition('=')
            if sep and key in ('DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL'):
                values[key] = value.strip().strip('\"\'')
    return {key: os.environ.get(key, values.get(key, default)).strip() for key, default in (
        ('DEEPSEEK_API_KEY', ''), ('DEEPSEEK_MODEL', 'deepseek-flash'))}


async def generate(message, history, report=False):
    config = settings()
    if not config['DEEPSEEK_API_KEY']:
        raise HTTPException(503, 'AI 尚未配置：请在 backend/.env 中设置 DEEPSEEK_API_KEY。')
    body = {
        'model': config['DEEPSEEK_MODEL'], 'max_tokens': 2200 if report else 1200, 'stream': False,
        'thinking': {'type': 'disabled'},
        'messages': [{'role': 'system', 'content': '你是冷酸宁健康助手，使用简洁自然的中文交流，提供一般健康知识和生活习惯建议。你只能使用用户在消息中明确提供的健康数据，没有独立访问数据库的权限，不得编造用户记录。不要提供诊断、处方或调整用药的指令；遇到紧急症状应建议及时就医。'}]
                    + [item.model_dump() for item in history] + [{'role': 'user', 'content': message}],
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post('https://api.deepseek.com/chat/completions',
                headers={'Authorization': f"Bearer {config['DEEPSEEK_API_KEY']}"}, json=body)
        if response.status_code in (401, 403):
            raise HTTPException(502, 'AI 身份验证失败，请检查 API Key 和模型访问权限。')
        if response.status_code == 402:
            raise HTTPException(503, 'DeepSeek 账户余额不足，请充值后重试。')
        if response.status_code == 429:
            raise HTTPException(503, 'AI 配额不足或请求过于频繁，请检查账户额度后重试。')
        response.raise_for_status()
        data = response.json()
        choice = data['choices'][0]
        text = choice['message'].get('content')
        if choice.get('finish_reason') != 'stop' or not isinstance(text, str) or not text.strip():
            raise HTTPException(502, 'AI 未返回完整回复，请重试。')
        return {'reply': text.strip(), 'mode': 'ai', 'model': config['DEEPSEEK_MODEL']}
    except httpx.TimeoutException:
        raise HTTPException(504, 'AI 回复超时，请稍后重试。')
    except (httpx.HTTPError, ValueError, KeyError, TypeError, IndexError):
        raise HTTPException(502, '暂时无法获取 AI 回复，请检查网络和模型配置后重试。')
