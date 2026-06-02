---
doc_kind: decision
created: 2026-06-02
status: accepted
---

# D001 — 技术栈选择

## 上下文

项目从零开始，需要选择语言、运行时、LLM 接入方式、存储方案。

## 决策

| 维度 | 选择 | 理由 |
|------|------|------|
| 语言 | TypeScript | 用户选择；Node.js 生态丰富，适合 CLI 工具 |
| 运行时 | Node.js ≥ 20 | 稳定，ESM 支持完善 |
| LLM 接入 | 三套适配器（Claude / OpenAI / Ollama） | 多模型可切换，不锁定供应商 |
| 存储 | SQLite (better-sqlite3) | 嵌入式、单文件、FTS5 全文搜索、零运维 |
| 向量检索 | 云端 Embedding API + 本地向量库 | 质量高，成本可控 |
| CLI 框架 | 待定（Inquirer.js / @clack/prompts） | Phase 1 实现时再选 |
| 包管理 | npm | 标准，够用 |

## 后果

- better-sqlite3 是 native addon，需要编译环境（node-gyp / cmake）
- 多模型适配器需要统一接口抽象，增加初始复杂度
- 后期可替换为自研框架，适配器层是替换边界
