---
doc_kind: spec
created: 2026-06-02
phase: 1
status: draft
depends_on: [D001, D002, D003, D004]
---

# S001 — 项目骨架

## Why

所有后续功能需要一个可运行的项目骨架：CLI 入口、Agent 主循环、LLM 适配器接口、Hook 系统。

## What

### A. 项目初始化

- [ ] AC-A1：`npm install` 可正常安装依赖
- [ ] AC-A2：`npm run dev` 可启动 CLI，进入对话模式
- [ ] AC-A3：`npm run build` 可编译 TypeScript 到 dist/

### B. CLI 入口

- [ ] AC-B1：启动后显示欢迎信息
- [ ] AC-B2：支持多行输入，回车发送
- [ ] AC-B3：输入 `exit` / `quit` 退出
- [ ] AC-B4：支持 `--model <name>` 参数切换 LLM 模型

### C. Agent 主循环

- [ ] AC-C1：接收用户输入 → 调用 LLM → 输出回复
- [ ] AC-C2：支持 Tool Use（LLM 可调用注册的工具）
- [ ] AC-C3：在关键节点触发 Hook（见 D004）

### D. LLM 适配器

- [ ] AC-D1：定义 `LLMAdapter` 接口（chat / chatWithTools）
- [ ] AC-D2：实现 Claude 适配器（Anthropic SDK）
- [ ] AC-D3：实现 OpenAI 适配器
- [ ] AC-D4：根据 `--model` 参数选择适配器

### E. Hook 系统

- [ ] AC-E1：实现 Hook 注册中心（register / trigger）
- [ ] AC-E2：在 Agent 主循环的关键节点触发 Hook

## Dependencies

- 决策：D001（技术栈）、D004（Hook 机制）
- 后续：S002（日记提取）依赖本 Spec 的骨架

## 关键文件

```
src/
  index.ts              # CLI 入口，参数解析
  agent/
    core.ts             # Agent 主循环
    types.ts            # 核心类型定义
  adapters/
    base.ts             # LLMAdapter 接口
    claude.ts           # Claude 适配器
    openai.ts           # OpenAI 适配器
  hooks/
    types.ts            # Hook 类型定义
    registry.ts         # Hook 注册中心
  utils/
    config.ts           # 配置管理（读取 .env）
```

## Open Questions

- CLI 框架选 Inquirer.js 还是 @clack/prompts？
- 是否 Phase 1 就实现 Ollama 适配器，还是放到 Phase 4？
