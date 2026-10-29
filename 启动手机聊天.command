#!/bin/zsh
set -e
cd "${0:A:h}"
chat_ip=$(ipconfig getifaddr en0)
if [[ -z "$chat_ip" ]]; then
  echo '未找到 Wi-Fi 地址，请连接 Wi-Fi 后再试。'
  exit 1
fi
echo "手机聊天服务：http://$chat_ip:8001（请保持此窗口打开）"
backend/.venv/bin/python -m uvicorn lan_chat:app --app-dir backend --host "$chat_ip" --port 8001
