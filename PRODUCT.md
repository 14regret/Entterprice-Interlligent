# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + `motion/react`（`LazyMotion` + `domAnimation`）前端；
FastAPI + ChromaDB + rank-bm25/jieba + Redis（`redis.asyncio`）+ Ollama 后端。
用户已在需求中钉死技术栈，此处记录为委派结果。

## Users

企业内部员工（人事、销售、客服、运营等非工程角色），坐在办公桌前，用自然语言查制度、流程与产品资料。
他们熟悉聊天工具，不熟悉检索语法，也没有耐心读检索结果列表。
次要用户：知识库维护者，负责上传、核对与清理 PDF。

> 假设（未经确认）：具体部门、公司规模、是否需要管理后台，尚未明确。

## Product Purpose

把散落在 PDF 里的企业知识变成可追溯的回答。
成功 = 员工在 30 秒内拿到带出处的答案，或拿到一句明确的「资料里没有」。

## Positioning

不是通用聊天机器人：答案只能来自本机已入库文档，逐条标注出处，证据不足时拒答。
全链路本地运行，文档不出内网——这是采购与合规层面唯一无法被替代的事实。

## Operating Context

Windows 11 工作站/内网服务器；Ollama 监听 11434；Redis 5.0 本地服务；Chroma 持久化到磁盘。
用户经常同时打开多个 PDF 对照阅读，答案会被复制进邮件、工单或会议纪要。
提问以中文为主，夹杂产品型号、英文术语与数字。

## Capabilities and Constraints

- PDF 上传 → 解析 → 600/120 滑动窗口分块 → Chroma 向量索引 + jieba/BM25 关键词索引 → RRF 融合。
- SSE 流式回答；Redis 会话记忆 6 轮 / 30 分钟；语义缓存阈值 0.92；全局 30 请求/分钟。
- 生成 `qwen2:1.5b`，向量 `nomic-embed-text`（768 维）。1.5B 能力有限，防幻觉与拒答是硬约束。
- 本机 Redis 为 5.0.14（Windows 版，无 RediSearch），语义缓存不能依赖 Redis 向量检索。
- 未确认：多租户、账号与权限、PDF 之外的格式、单文件大小上限。

## Brand Commitments

名称 **Nexus 智询**（用户暂定）。语气精确、克制、不营销；界面以中文为主，术语保留英文原词。
不做人格化卖萌的「AI 助手」，不承诺模型能力之外的事。

## Evidence on Hand

无真实客户、案例、基准或性能数据。界面里的文档名、页数、分块数、耗时必须来自真实 API；
需要示例时明确标注为示例，不得编造企业名称、合规承诺或准确率。

## Product Principles

1. 出处先于语气：没有引用的答案不算完成。
2. 拒答是功能：资料不足时明确说不知道，并指出缺什么。
3. 本地即边界：任何功能都不能把文档内容发往外部服务。
4. 密度服务检索：信息密度高，但不牺牲可读性与键盘可达性。
5. 状态诚实：索引中、失败、缓存命中、限流都必须可见。

## Accessibility & Inclusion

键盘完成提问、上传、删除；焦点环可见；正文对比度 ≥ 4.5:1；尊重 `prefers-reduced-motion`。
