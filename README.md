# 知康 · AI 健康助手

基于选定的柔和绿渐变设计稿搭建的本地单用户原型。

## 目录

- `frontend/`：React + TypeScript + Vite；包含 Capacitor 配置
- `backend/`：Python FastAPI + SQLite 本地演示服务
- `design/ui-reference.png`：原始 UI 设计稿

## 启动

需要 Node.js 22.12+（或 Vite 支持的更新版本）和 Python 3.9+。

首次准备：

```sh
cd frontend
npm ci
cd ../backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-lock.txt
```

在工程根目录双击 `启动知康.command`，或运行：

```sh
./启动知康.command
```

随后访问 http://127.0.0.1:5173 。停止时在启动终端按 Ctrl+C。

也可以分别启动：

```sh
cd backend
.venv/bin/python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```sh
cd frontend
npm run dev
```

API 文档：http://127.0.0.1:8000/docs

## 已实现

- 对话 / 健康 / 我的：三个响应式页面与底部导航
- 固定规则的聊天演示与快捷问题，明确标记 AI 未接入
- 饮水、体重记录：经 API 保存到 `backend/data/health.sqlite3`
- 图表示例、体重最新值、称呼编辑、JSON 数据导出
- 用户头像：在「我的 → 健康档案」上传，自动居中裁方并压缩后仅存本机浏览器；「我的」资料卡与对话中用户消息旁显示最新头像，可随时更换或移除
- 提醒偏好本地保存；实际系统通知未接入
- 连接失败提示、保存失败提示、表单校验

初始 1,300 mL 饮水和 62.0 kg 体重为演示基线；图表历史、睡眠和散步为示例。聊天不持久化；称呼与提醒偏好存储于浏览器。数据库使用本机日期归档记录，部署前需明确统一用户时区。

## 验证

```sh
cd frontend
npm run build
cd ../backend
.venv/bin/python -m unittest test_api.py
```

## 后续接入

1. 为 FastAPI 添加登录、按用户隔离的数据访问和正式健康档案。
2. 将 SQLite 切换为 PostgreSQL，使用 SQLAlchemy / Alembic 管理数据。
3. 在后端接模型 API 与流式响应；密钥仅放后端，不放 `VITE_` 变量。
4. 为趋势图接入真实历史数据；加入授权、数据删除和模型质量评估。
5. iOS 平台工程已生成，已加入 HealthKit 读取桥接和健康页连接入口；Android 尚未生成。iPhone 安装步骤见下文。

Vite 开发代理将 `/api` 转发到本机 8000。独立部署或 Capacitor 真机运行时需设置 `VITE_API_BASE_URL` 为可达的 HTTPS 服务地址，并由后端配置允许的来源；`127.0.0.1` 在真机中指手机自身。

**当前仅供本机演示，缺少登录、用户隔离及生产级隐私保护，请勿输入真实敏感信息或对公网部署。** 不提供医学诊断、处方或用药调整。


## iPhone / Apple 健康接入

已准备 `frontend/ios/App/App.xcodeproj`，采用 Capacitor 8 和 Swift Package Manager。

- 只请求读取今日步数、最近一次体重、昨夜睡眠；不请求写入权限。
- 昨夜睡眠统计窗口为本地时间昨天 18:00 至今天 12:00（不超过当前时刻），只统计睡眠阶段，重叠样本合并后计算，避免多设备重复累加。
- 空结果不等于拒绝授权；Apple 不提供读取授权状态。界面提示用户检查数据和系统权限。
- 读取结果单独显示在 Apple 健康卡片，只保留在页面内存，不进入 localStorage、Python 数据库、导出文件或模型请求。
- 手动记录、演示趋势与 Apple 健康卡片明确分开。暂未实现历史趋势替换、自动后台同步或心率读取。
- 读取范围与用途已写入 Info.plist，HealthKit entitlement 和原生插件注册已配置。

### 真机运行

1. 本机已安装 Xcode 27.1，已通过 iPhoneOS SDK 的无签名 Debug 编译。首次使用时仍需在 Xcode → Settings → Accounts 登录自己的 Apple ID。
2. 在工程 `frontend` 下执行：

```sh
npm run ios:sync
npm run ios:open
```

3. Xcode 中选择 App target，在 Signing & Capabilities 中选择你的开发团队，必要时修改为你可用的唯一 Bundle Identifier，确认 HealthKit capability 存在。签名账户须具备该能力。
4. 连接并信任 iPhone，按系统提示启用开发者模式，选择该设备运行。真机最低系统版本由 Capacitor/Xcode 工程要求决定（当前工程 iOS 15+）。
5. 打开「健康」页，点击「连接 Apple 健康」，由你在系统弹窗中选择允许读取的数据类型。随后查看同步结果。

健康数据读取不依赖 Python 后端，可先单独验证。其他原型接口在 App 内默认无法连接本机 Vite 代理；如需同时测试后端，应配置受控的 HTTPS 地址与 CORS。不要通过关闭 ATS 或暴露无鉴权本地服务来绕过。

### 验证范围

`npm run build` 和 `npx cap sync ios` 已验证；`npm run test:sleep` 验证睡眠时段重叠、裁剪、空样本的聚合。Info.plist、entitlements 和 Xcode 工程通过 plutil 语法检查。2026-10-29 已使用 Xcode 27.1 / iPhoneOS 27.1 SDK 完成 `xcodebuild -project frontend/ios/App/App.xcodeproj -scheme App -configuration Debug -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath /tmp/zhikang-ios-build CODE_SIGNING_ALLOWED=NO build`，结果为 BUILD SUCCEEDED。HealthKit Swift 桥接已通过编译；尚未完成开发团队签名、真机安装和系统授权验证，不能视为已完成真机连接。

## 本地 Apple 健康 XML 导入

```sh
backend/.venv/bin/python backend/import_apple_health.py /绝对路径/导出.xml
```

流式读取 XML，仅保留步数、睡眠、体重和心率的日汇总，写入 Git 忽略的 `backend/data/apple-health.json`。重复执行会原子替换导入快照，不修改手动记录。启动本地服务后在「健康」页查看真实数据卡片及最近 14 个有记录日期；`/api/apple-health` 提供完整日汇总。上海时区；每日步数取总量最大的单一来源，与 Apple 合并算法可能不同；睡眠按片段结束日期归档，合并重叠区间；心率为样本算术平均。原始 XML、心电图和运动路线不复制到项目，数据不进入聊天或 AI 请求。网页导出按钮仍只导出原有手动记录。

## 真实 AI 聊天

编辑本机 `backend/.env`，填写 `DEEPSEEK_API_KEY`；`DEEPSEEK_MODEL` 默认 `deepseek-flash`。密钥仅限后端，不提交 Git。保存后刷新网页即可，无需重启。`/api/ai/status` 返回是否配置与模型名，不返回密钥。

后端调用 `https://api.deepseek.com/chat/completions`，以非思考模式发送当前问题及最多 20 条对话消息，不自动附带健康数据或档案。聊天只在页面内存中保留；未配置、余额不足或上游失败时明确报错。测试使用模拟上游，真实调用需要有效 DeepSeek API Key。

官方文档：https://api-docs.deepseek.com/

### 今日健康报告

在对话中发送「帮我分析今日健康数据」「今天健康情况怎么样」等文案，或点击分析入口，会直接读取今天的数据并返回健康报告，无需先生成报告或再次确认。界面说明会将今日健康摘要发送到 DeepSeek。

电脑端读取上海时区今天的本地导入及手动记录；手机端在已开启 Apple 健康连接后实时刷新今天的 HealthKit 数据，通过带访问令牌的局域网接口分析，不会混用 Mac 的健康数据。摘要不包含姓名或完整健康历史，历史体重保留测量日期；报告默认不加入后续普通聊天上下文。无权限、读取失败或模型错误会直接显示提示。

### iPhone 同 Wi-Fi 聊天测试

双击项目根目录 `启动手机聊天.command`，在 Mac 当前 Wi-Fi 地址的 8001 端口运行独立的聊天网关。手机与 Mac 同网，首次运行需允许本地网络访问。该服务仅提供 `/api/chat` 和 `/api/ai/status`，要求专用随机访问令牌，不开放健康数据接口；DeepSeek 密钥仍只在 Mac 后端。

手机版地址和测试访问令牌位于已忽略的 `frontend/.env.ios.local`，通过 `npm run ios:sync` 打包。Mac 的 Wi-Fi IP 变化后需更新地址并重新安装。当前为局域网 HTTP 测试，勿端口转发或用于公网；正式部署需 HTTPS。Mac 需保持运行。手机版健康分析通过 `/api/report/analyze` 提交当前手机的今日摘要；普通聊天不自动附带 HealthKit 数据。

## Vercel 云端测试部署

当前后端地址：`https://zhikang-health-api.vercel.app`。项目入口为 `backend/app.py`，仅暴露带 Bearer 令牌的聊天、模型状态和手机健康摘要分析接口，不开放 SQLite、健康导入或电脑端数据接口。部署根目录为 `backend`。

在 Vercel Production 环境配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`LAN_CHAT_TOKEN`（当前测试客户端访问令牌）。本地 `.env`、`.env.local`、`data`、虚拟环境和测试文件通过 `.vercelignore` 排除。不要上传包含密钥的构建产物。该版本用于个人手机测试，共享客户端令牌不等于多用户登录系统。

手机通过已忽略的 `frontend/.env.ios.local` 设置 HTTPS 地址和对应测试访问令牌，再运行 `npm run ios:sync` 打包。普通聊天仅发送对话文字；用户请求今日健康分析时提交手机当天摘要。后端不保存健康摘要或聊天历史。云端上线后不再要求 Mac 常驻或同 Wi-Fi。


## 聊天 Tools 与附件

聊天页「＋」展开淡紫色 Tools 面板，可选择图片、文件或文件夹；iPhone 使用原生文件夹选择器，网页使用目录选择。选中文件后先在本机预览和移除，点击发送后才经后端交给 DeepSeek 分析，不在后端持久化附件。附件随本次对话保留在内存，后续问题会带上最近 20 条消息内的附件上下文；开始新对话或重启后清除。

支持 PNG/JPEG/WebP/GIF、PDF、DOCX、TXT/Markdown/CSV/JSON。PDF 同时提取正文和页面图像，支持扫描件；DOCX 仅提取正文，不含嵌入图片。文件夹仅导入支持格式并保留相对路径。每个会话最多 8 个文件、原始文件合计 2.5 MB；每份 PDF 最多 12 页，会话图片与 PDF 页面合计最多 16 张，正文最多 10 万字符，超限提示拆分或新建对话，不静默截断。

附件对话使用支持视觉的 `deepseek-flash`，沿用服务端 `DEEPSEEK_API_KEY`，普通聊天继续使用 `DEEPSEEK_MODEL`。依赖 PyMuPDF 处理 PDF；验证命令：`cd backend && .venv/bin/python -m unittest test_chat_attachments test_ai_chat test_lan_chat test_report`。
