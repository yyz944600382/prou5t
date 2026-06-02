---
doc_kind: note
created: 2026-06-02
spec: S001
reviewer: claude-reviewer
---

# 审查报告 — S001 项目骨架

## 审查结果：不通过 → 修复后待复审

## AC 验证

| AC | 结果 | 说明 |
|----|------|------|
| AC-A1 | ✅ | npm install 正常 |
| AC-A2 | ✅ | npm run dev 可启动 |
| AC-A3 | ✅ | npm run build 编译通过 |
| AC-B1 | ✅ | p.intro 欢迎信息 |
| AC-B2 | ✅ | p.text 回车发送 |
| AC-B3 | ✅ | exit/quit 退出 |
| AC-B4 | ✅ | --model 参数支持 |
| AC-C1 | ✅ | 输入→LLM→回复 |
| AC-C2 | ✅ | Tool Use 支持 |
| AC-C3 | ✅ | Hook 触发（修复前缺 beforeConversation） |
| AC-D1 | ✅ | LLMAdapter 接口 |
| AC-D2 | ✅ | Claude 适配器 |
| AC-D3 | ✅ | OpenAI 适配器 |
| AC-D4 | ✅ | 工厂函数选择适配器 |
| AC-E1 | ✅ | HookRegistry 实现 |
| AC-E2 | ✅ | 主循环集成 Hook |

## 发现的问题

### 阻塞项（已修复）

1. **beforeConversation Hook 未触发**
   - 位置：src/index.ts
   - 问题：AgentCore 构造后没有调用 hooks.trigger("beforeConversation", ...)
   - 修复：在 chatLoop() 前添加触发调用

2. **无效的 conversation 变量**
   - 位置：src/index.ts:40-46
   - 问题：p.group() 获取的输入从未使用，用户白输一次
   - 修复：删除该段代码

### 建议修复（已修复）

3. **工具结果 role 映射**
   - 位置：src/agent/core.ts handleToolResult()
   - 问题：工具结果以 user 角色注入，不符合各 API 规范
   - 修复：添加 TODO 注释标注局限性，后续 S002 改进

4. **Message system 角色处理**
   - 位置：src/adapters/claude.ts, src/adapters/openai.ts
   - 问题：system 消息会被错误映射为 assistant
   - 修复：添加 filter/continue 跳过 system 消息

## 架构一致性

| 决策 | 结果 | 说明 |
|------|------|------|
| D001 技术栈 | ✅ | 完全一致 |
| D002 文档驱动 | ✅ | spec + decisions 齐全 |
| D003 记忆日记边界 | ✅ | 本阶段不涉及，Hook 预留正确 |
| D004 Hook 机制 | ✅ | 修复后四个生命周期节点均有触发 |
| D005 分支与质量 | ✅ | 正在执行审查流程 |
