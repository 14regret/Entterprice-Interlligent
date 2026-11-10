# Nexus 智询 · Enterprise RAG

本地化企业智能问答系统。文档不出内网：PDF 解析、向量化、检索、生成全部跑在本机
Ollama（`qwen2:1.5b` + `nomic-embed-text`）上；Redis 承担限流、会话记忆与语义缓存。

> 当前进度：**三步全部完成**，并已在真实环境联调通过：
> 上传 → 解析/分块 → Chroma + BM25 双索引 → 混合检索 → qwen2 流式回答 →
> 引用栏 → 语义缓存 → 会话记忆 → 限流。
> 前端在 1440×900、1280×800、390×844 验证；后端用两份真实中文 PDF 做过问答、拒答、删除与缓存失效测试。

视觉与产品语境见 [PRODUCT.md](PRODUCT.md) 与 [DESIGN.md](DESIGN.md)。

![Python](https://img.shields.io/badge/Python-3.12-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-8000-009688)
![React](https://img.shields.io/badge/React-18-61dafb)
![Ollama](https://img.shields.io/badge/Ollama-qwen2%3A1.5b-black)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 架构

```
┌──────────────────────────────────────────────────────────────────────┐
│ Browser  127.0.0.1:5173                                              │
│ AppShell · Sidebar · ChatPanel · Composer · StreamingText            │
│ lib/sse.ts : fetch + ReadableStream                                  │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ Vite proxy  /api → 127.0.0.1:8000
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FastAPI 8000 · lifespan                                              │
│                                                                      │
│  RedisStore(RESP2)   Chroma(documents, semantic_cache)               │
│  BM25L(pickle)       OllamaGateway(qwen2:1.5b + nomic-embed-text)    │
│                                                                      │
│  POST /api/upload                                                    │
│    └─ IngestService → pypdf → 600/120 chunk → embed                  │
│       → Chroma + BM25L → status: processing → ready                  │
│                                                                      │
│  POST /api/chat                                                      │
│    └─ RateLimiter (Lua token bucket, 30/min)                         │
│       └─ embed query                                                 │
│          ├─ SemanticCache.lookup (Chroma ANN, ≥0.92)                 │
│          │    └─ hit → Redis payload → SSE(meta.cached=true)         │
│          └─ miss → Retriever                                         │
│               ├─ Chroma top8 + BM25L top8 → RRF(k=60)                │
│               ├─ evidence filter: 词覆盖优先，余弦兜底                 │
│               ├─ gate: sim<0.60 且 coverage<0.55 → 直接拒答           │
│               ├─ Redis memory (6 turns) + strict prompt              │
│               ├─ Ollama stream → citation guard → SSE token          │
│               └─ write memory + semantic cache                       │
│                                                                      │
│  GET /api/documents · DELETE /api/documents/{id} · GET /api/health   │
└──────────────────────────────────────────────────────────────────────┘
```

两条关键时序：

1. **上传**：`202 + processing` 立即返回；后台按 1 份文档串行解析、分块、向量化，
   前端每 2.5s 轮询 `/api/documents`，成功后状态切 `ready`。上传/删除都会清空语义缓存。
2. **问答**：先限流，再语义缓存；未命中才做混合检索。检索门控不通过时不调用模型，
   直接返回固定拒答；通过后拼 6 轮记忆 + 证据，流式生成，最后补引用标记并写缓存。

## 目录结构

```
EntterpriceInterlligent/
├─ README.md
├─ PRODUCT.md                        # 产品事实与假设（impeccable init）
├─ DESIGN.md                         # 令牌、组件、状态、动效规则
├─ .gitignore
├─ scripts/
│  ├─ dev.ps1                        # 一键启动前后端
│  └─ stop.ps1                       # 停止 8000 / 5173 监听进程
│
├─ frontend/
│  ├─ package.json
│  ├─ package-lock.json
│  ├─ vite.config.ts                 # @vitejs/plugin-react + @tailwindcss/vite + /api 代理
│  ├─ tsconfig.json                  # solution 入口
│  ├─ tsconfig.app.json
│  ├─ tsconfig.node.json
│  ├─ index.html
│  ├─ .env.example
│  ├─ public/
│  │  └─ favicon.svg
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx                     # LazyMotion(features=domAnimation, strict) 根节点
│     ├─ types.ts
│     ├─ styles/
│     │  └─ index.css                # Tailwind v4 @theme 令牌 + 光标/扫描线
│     ├─ lib/
│     │  ├─ api.ts                   # REST + SSE 流
│     │  ├─ sse.ts                   # ReadableStream → SSE 帧
│     │  ├─ motion.ts                # 时长/缓动/共享 variants
│     │  ├─ errors.ts                # 错误文案归一
│     │  ├─ pdf.ts                   # PDF 类型 / 20MB 校验
│     │  └─ cn.ts                    # clsx + tailwind-merge
│     ├─ hooks/
│     │  ├─ useChat.ts               # 发送、流式追加、中止、复位
│     │  ├─ useDocuments.ts          # 列表 + 上传 + processing 轮询
│     │  └─ useAutoScroll.ts         # 贴底滚动（用户上翻时停止）
│     └─ components/
│        ├─ shell/
│        │  ├─ AppShell.tsx          # 两栏 + 移动端抽屉
│        │  ├─ Sidebar.tsx           # 深色索引栏
│        │  ├─ WorkspaceHeader.tsx   # SID / MODEL / DOCS / MEMORY
│        │  └─ BrandMark.tsx         # 索引脊标记
│        ├─ knowledge/
│        │  ├─ DocumentList.tsx
│        │  ├─ DocumentItem.tsx      # 状态、页/块、两段式删除
│        │  └─ UploadDropzone.tsx    # 拖拽/点选，PDF 校验
│        ├─ chat/
│        │  ├─ ChatPanel.tsx
│        │  ├─ MessageList.tsx       # AnimatePresence 消息入场
│        │  ├─ MessageItem.tsx       # 正文 + 证据栏
│        │  ├─ StreamingText.tsx     # rAF 逐字揭示 + 方块光标
│        │  ├─ CitationList.tsx      # [n] 文档 / 页码 / 块 / 分数
│        │  ├─ Composer.tsx          # Enter、IME、停止、上传
│        │  └─ EmptyChat.tsx
│        └─ ui/
│           ├─ Button.tsx
│           ├─ IconButton.tsx
│           ├─ Badge.tsx
│           ├─ StatusDot.tsx
│           └─ Toaster.tsx
│
└─ backend/
   ├─ requirements.txt
   ├─ requirements-dev.txt          # pytest / pytest-asyncio / httpx
   ├─ .env.example
   ├─ app/
   │  ├─ main.py                    # create_app + lifespan + CORS
   │  ├─ config.py                  # pydantic-settings，读取 .env
   │  ├─ api/
   │  │  ├─ chat.py                 # POST /api/chat → SSE
   │  │  ├─ documents.py            # POST /api/upload、GET/DELETE /api/documents
   │  │  ├─ system.py               # GET /api/health（Ollama/Redis/索引）
   │  │  └─ deps.py                 # 依赖注入（retriever / cache / limiter）
   │  ├─ core/
   │  │  ├─ lifespan.py             # Redis ConnectionPool、Chroma、BM25 预热
   │  │  ├─ container.py            # Services 依赖容器
   │  │  ├─ sse.py                  # 统一 SSE 帧格式 + 心跳
   │  │  └─ logging.py
   │  ├─ rag/
   │  │  ├─ chunking.py             # 600 字符 / 120 重叠，句界优先
   │  │  ├─ embeddings.py           # nomic-embed-text（search_query/document 前缀）
   │  │  ├─ vector_store.py         # Chroma collection: documents / semantic_cache
   │  │  ├─ keyword_index.py        # jieba + BM25L，pickle 持久化
   │  │  ├─ fusion.py               # RRF（k=60）
   │  │  ├─ retriever.py            # 向量 + 关键词并联召回 + 证据过滤
   │  │  └─ prompting.py            # 短系统提示、上下文模板、拒答判定
   │  ├─ llm/
   │  │  └─ ollama_client.py        # AsyncClient.chat(stream=True)
   │  ├─ services/
   │  │  ├─ registry.py             # 文档状态 JSON 注册表
   │  │  ├─ ingest.py               # 解析 → 分块 → 双索引 → 状态流转
   │  │  └─ chat.py                 # 缓存 → 检索 → 记忆 → 流式生成
   │  ├─ infra/
   │  │  ├─ redis_pool.py           # redis.asyncio.ConnectionPool（RESP2）
   │  │  ├─ semantic_cache.py       # ANN 召回 + Redis 载荷 + 阈值 0.92
   │  │  ├─ memory.py               # session:{id}:history（List，TTL 30min）
   │  │  └─ rate_limit.py           # Lua 令牌桶，全局 30 req/min
   │  ├─ schemas/
   │  │  ├─ chat.py
   │  │  └─ documents.py
   │  └─ tests/
   │     ├─ test_chunking.py
   │     └─ test_fusion.py
   │
   └─ data/                         # 运行时生成，已 gitignore
      ├─ uploads/
      ├─ chroma/
      └─ index/bm25.pkl
```

## 关键设计决策

1. **语义缓存不能只靠 Redis。** 本机 Redis 为 5.0.14（Windows 版，无 RediSearch），
   不支持向量检索。方案：Chroma 独立 collection `semantic_cache` 做 ANN 召回，
   命中后从 `cache:answer:{hash}` 取完整答案载荷（含引用），阈值 0.92；
   但 nomic-embed-text 会把无关短问句算到 0.997，所以命中还要求缓存问题覆盖新问题
   ≥35% 的内容词（`CACHE_MIN_QUESTION_OVERLAP`），否则回退检索。
   Chroma 不可用时退化为 Redis 最近 100 条向量在 numpy 中暴力余弦；
   任何上传/删除都会清空缓存，避免旧答案落后于新的知识库。
2. **混合检索用 RRF 而非加权求和。** 向量分与 BM25 分不同量纲，RRF 只看排名，
   `score = Σ 1/(60 + rank)`；融合取 top 6，再做一次证据过滤后才进上下文。
3. **分块按句界回退。** 600/120 的硬切会截断中文句子；实现时在窗口尾部回退到
   最近的 `。！？；\n`，保证块内语义完整。
4. **上传异步化。** 百页 PDF 的向量化在 1.5B 环境可能耗时数分钟，`POST /api/upload`
   返回 `202 + processing`，前端轮询 `GET /api/documents` 获取 `ready/failed`。
5. **防幻觉不是一句 Prompt，而是四道闸。**
   ① 检索门控：余弦 < 0.60 且关键词覆盖 < 0.55 时，不调用模型，直接返回固定拒答；
   ② 短 Prompt：只保留“只用资料、标 [1]、资料未写就说资料未说明”几条，1.5B 才不会误拒答；
   ③ 引用兜底：1.5B 几乎不执行引用格式，后端检测到没有 `[n]` 时补一个 `[1]`；
   ④ 拒答收尾：模型若回答“资料未说明”，补发空 `meta` 清掉证据栏，不让拒答挂着引用。
6. **1.5B 的上下文预算。** 6 个片段 ≈ 3.6k 字符，加 6 轮历史仍可控；历史只保留
   用户问题与助手最终答案，不保留中间 token 流。
7. **前端动效按需加载。** `LazyMotion features={domAnimation}` + `m.*` 组件，
   避免整包 framer-motion；时长/缓动统一在 `lib/motion.ts`，不在组件里散落魔数。
8. **不引入 Ant Design X。** 它绑定 antd 运行时（体积大）且默认聊天壳与「精密极简」
   的设计语言冲突；聊天骨架自建，换来完整的视觉控制权与更小的首屏。
9. **界面走「索引台」而不是聊天模板。** 深色知识栏 + 瓷白工作区，铜绿只标记出处与焦点；
   回答右侧是常驻的证据栏，而不是气泡角落的角标。令牌与状态见 `DESIGN.md`。
10. **860px 统一内容轴。** 消息、空状态、输入台同宽同轴（1280/1440 验证过）；
    证据栏在 `<1280px` 落到正文下方，`<1024px` 侧栏变抽屉。
11. **Redis 5.0 必须显式 RESP2。** redis-py 8 默认 RESP3 会发 `HELLO 3`，本机 Redis 5
    不认识，连接直接失败；`ConnectionPool(protocol=2)` 后正常。Redis 故障时缓存/记忆/
    限流全部降级，不阻断问答。
12. **小语料用 BM25L。** 只有一份文档时 `BM25Okapi` 的 IDF 为负，真实命中会被“正分过滤”
    丢掉；改用 `BM25L`，并按“查询词与块有重叠”召回，而不是看分数正负。
13. **证据栏先看词证据，再看余弦。** 小语料里余弦会“看起来都差不多”：问数据泄露，
    差旅文档余弦 0.670、词覆盖 0，信息安全文档余弦 0.638、词覆盖 0.50，旧规则会留下错误来源。
    现在只要存在词覆盖 ≥0.30 的候选就只保留它们；完全没有词证据时才退回余弦 ≥0.65，
    仍为空则保留第一条作为最低审计线索。
14. **引用编号是后端的契约。** `[1]` 由后端补，不依赖模型；证据栏的页码、文档名、
    相关度都来自检索结果，不来自模型文本。

## HTTP 契约

| Method | Path | 说明 |
|---|---|---|
| `POST` | `/api/upload` | `multipart/form-data`，字段 `file`；202 + 文档元数据 |
| `GET` | `/api/documents` | 文档列表与索引状态 |
| `DELETE` | `/api/documents/{id}` | 删除文档、分块与 BM25 条目 |
| `POST` | `/api/chat` | `{sessionId, question}` → `text/event-stream` |
| `GET` | `/api/health` | Ollama / Redis / 索引就绪状态 |

需求中的 `/upload`、`/chat` 统一挂 `/api` 前缀，便于 Vite 代理与生产反代。

### SSE 事件

```
event: meta     data: {"citations":[...],"cached":false,"sessionId":"..."}
event: token    data: {"t":"片段"}
event: done     data: {"answerId":"...","elapsedMs":1234}
event: error    data: {"code":"RATE_LIMITED","message":"..."}
: ping                                     ← 15s 心跳，防代理断流
```

`meta` 可能出现两次：第一次带检索到的引用；若模型最终回答“资料未说明”，
后端会再发一次空 `citations` 的 `meta`，把证据栏清空。前端对后到的 `meta` 覆盖处理即可。

## 环境变量

见 `backend/.env.example` 与 `frontend/.env.example`。核心项：

| Key | Default | 说明 |
|---|---|---|
| `CHAT_MODEL` | `qwen2:1.5b` | 生成模型 |
| `EMBED_MODEL` | `nomic-embed-text` | 768 维向量 |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | 单库复用 |
| `RATE_LIMIT_PER_MINUTE` | `30` | 全局令牌桶 |
| `SEMANTIC_CACHE_THRESHOLD` | `0.92` | 语义缓存余弦阈值 |
| `CACHE_MIN_QUESTION_OVERLAP` | `0.35` | 缓存命中的词重叠闸，防止向量碰撞 |
| `SESSION_TTL_SECONDS` | `1800` | 会话记忆 TTL |
| `MIN_CONTEXT_SIMILARITY` | `0.60` | 低于此余弦且关键词覆盖不足则拒答 |
| `MIN_KEYWORD_COVERAGE` | `0.55` | 关键词覆盖兜底阈值 |
| `EVIDENCE_SIMILARITY` | `0.65` | 无词证据时的余弦兜底 |
| `EVIDENCE_COVERAGE` | `0.30` | 有词覆盖时优先保留的来源 |
| `MAX_UPLOAD_MB` | `20` | 单份 PDF 上限 |
| `GENERATION_TIMEOUT_SECONDS` | `180` | 单次生成超时 |

## 已验证

| 场景 | 结果 |
|---|---|
| 上传中文 PDF | 202 → `processing` → `ready`；页数/块数正确 |
| 双文档检索 | “密码多久更换”命中信息安全手册；“住宿标准”命中差旅制度 |
| 词证据优先 | “数据泄露联系谁” → 信息安全部 [1]，不再误引差旅制度 |
| 答案与引用 | `90 天 [1]`、`1200 元 [1]`、`公开、内部、机密、绝密 [1]` |
| 改写提问 | “出差每天补贴多少” → `200 元 [1]`；“住宿费上限” → `1200 元 [1]` |
| 语义缓存 | 同一问题第二次 `cached: true`，耗时 45–56ms |
| 缓存防碰撞 | 无关问题余弦 0.9973 被词重叠闸拒绝，正确回答“12 位” |
| 拒答 | “公司的股票代码” → “资料未说明。”，0 条引用 |
| 限流 | 连续 40 次 → 38 次 200、2 次 429（17 秒内令牌桶已回补） |
| 删除 | 204 → 文档数减一 → 对应问题拒答 → 重新上传恢复 |
| 单元测试 | 6/6 通过（分块边界、短页保留、RRF 排序） |
| 滚动防打扰 | 流式中上翻 2.6s，滚动位置 drift=0；“回到最新”可回底 |
| 前端联调 | 真实 SSE、证据栏、缓存命中标记均正常，无 console error |

## 本地部署与启动指南

### 前置条件

| 依赖 | 版本 | 检查命令 |
|---|---|---|
| Windows | 10 / 11，PowerShell 5.1+ | `$PSVersionTable.PSVersion` |
| Python | 3.12 | `python --version` |
| Node.js | ≥ 22.12（Vite 8 引擎要求） | `node --version` |
| Redis | ≥ 5（本机 5.0.14） | `redis-cli ping` → `PONG` |
| Ollama | 本地 daemon | `ollama list` |
| 模型 | `qwen2:1.5b` + `nomic-embed-text` | `ollama pull qwen2:1.5b` |

不需要 Docker、WSL 或 GPU；全部数据留在本机。

### 首次安装（只做一次）

```powershell
# backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env

# frontend
cd ..\frontend
npm install
copy .env.example .env
```

如果 `jieba` / `rank-bm25` 的源码构建卡住，改用：

```powershell
.\.venv\Scripts\python.exe -m pip install --no-build-isolation -r requirements.txt
```

### 一键启动

```powershell
# 在项目根目录
.\scripts\dev.ps1
```

脚本会分别在两个新窗口启动 FastAPI 和 Vite；已在监听的端口会自动跳过。
如果 PowerShell 拦截脚本，用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1
```

| 入口 | 地址 |
|---|---|
| 应用 | http://127.0.0.1:5173 |
| API 文档 | http://127.0.0.1:8000/api/docs |
| 健康检查 | http://127.0.0.1:8000/api/health |

停止：

```powershell
.\scripts\stop.ps1
```

### 手动启动（两个终端）

```powershell
# 终端 1
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 终端 2
cd frontend
npm run dev
```

### 切换模型

- **只换生成模型**：`ollama pull qwen2.5:3b` → 改 `backend/.env` 的 `CHAT_MODEL` → 重启 uvicorn。
  代码无需改动；1.5B 的短回答与引用兜底逻辑仍生效。
- **换嵌入模型**：必须重建索引。改 `EMBED_MODEL` / `EMBED_DIM`，停止服务，删除
  `backend/data`，`redis-cli flushdb`，重启后重新上传文档。

### 重置知识库

```powershell
.\scripts\stop.ps1
Remove-Item -Recurse -Force backend\data
redis-cli flushdb
.\scripts\dev.ps1
```

`backend/data/` 同时包含上传原件、Chroma 与 BM25 快照；删除前确认原件有备份。

### 生产构建

```powershell
cd frontend
npm run build       # 产物在 frontend/dist
```

生产环境用 Nginx/Caddy 托管 `dist`，并把 `/api` 反代到 `127.0.0.1:8000`；
不要直接双击 `index.html` 打开 `file://`。

### 常见问题

| 现象 | 处理 |
|---|---|
| Redis 报 `unknown command HELLO` | Redis 5 只支持 RESP2；本项目已固定 `protocol=2`，自定义客户端同样要设 |
| `pip install` 卡在 jieba | 先装 `setuptools wheel`，再 `--no-build-isolation` |
| 上传后文档 `failed` | 扫描件没有文本层；先 OCR 或换带文本层的 PDF |
| 端口被占用 | `.\scripts\stop.ps1`，或改 `--port` / `vite.config.ts` |
| 前端 `/api` 404 | 后端未启动，或不在 8000；看 `http://127.0.0.1:8000/api/health` |
| 换了模型答案没变 | 重启 uvicorn；语义缓存可能还持有旧答案，上传/删除或 `redis-cli flushdb` |
| 中文日志显示乱码 | 控制台编码问题；用 UTF-8 终端，或启动前设 `$env:PYTHONUTF8=1` |
