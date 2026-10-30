# 阿里云函数计算部署

从仓库根目录构建：

```sh
docker build -f deploy/aliyun/Dockerfile -t zhikang-health-api .
```

镜像监听 9000；仅复制后端 API 源文件，不包含 `.env`、健康数据库、导出数据、iOS 工程或客户端令牌。

在函数环境变量配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` 和 `LAN_CHAT_TOKEN`。不能把密钥放进镜像或 Git。仅开放带令牌的聊天、状态、手机当天健康摘要分析接口。关闭请求访问日志，应用代码不记录健康摘要或聊天正文。

绑定 `api.healthai.icu` 和 HTTPS 证书。中国大陆部署前需核实域名 ICP 备案及接入要求；香港部署仍需实测大陆网络。

当前为部署准备文件，不表示阿里云资源已经创建。
