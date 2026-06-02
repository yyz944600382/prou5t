---
doc_kind: decision
created: 2026-06-02
status: accepted
---

# D004 — Hook 机制设计

## 上下文

记忆压缩、日记提取等横切关注点不能硬编码在主循环里，需要一种可插拔的机制。

## 决策

采用 Hook（钩子）机制，在 Agent 生命周期的关键节点插入自定义逻辑。

### Hook 生命周期

```typescript
interface Hook {
  name: string;
  beforeConversation?(ctx: SessionContext): Promise<void>;
  afterUserMessage?(ctx: SessionContext, message: string): Promise<void>;
  afterAssistantMessage?(ctx: SessionContext, message: string): Promise<void>;
  afterConversationEnd?(ctx: SessionContext): Promise<void>;
}
```

### 计划中的 Hook

| Hook | 触发点 | 用途 |
|------|--------|------|
| MemoryInjectHook | `beforeConversation` | 会话开始时注入记忆到上下文 |
| DiaryExtractHook | `afterUserMessage` | 检测回忆内容，触发日记提取 |
| MemoryCompressHook | `afterConversationEnd` | 会话结束时压缩对话为记忆 |
| LoggingHook | 所有节点 | 记录日志 |

### 设计原则

- Hook 是可选的，不注册就不执行
- Hook 之间相互独立，不依赖执行顺序
- Hook 可以被替换（后期自研时替换实现）

## 后果

- 主循环保持简洁，横切逻辑解耦
- 记忆压缩策略可以在不修改主循环的情况下更换
