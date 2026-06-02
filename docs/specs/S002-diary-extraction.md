---
title: S002 — 日记提取
status: Proposed
author: prou5t team
created: 2026-06-02
---

## Why

prou5t 的核心价值是帮助用户"回忆往事"并将这些回忆永久保存。用户在对话中讲述过去的事情时，系统需要自动识别、提炼、结构化这些回忆性内容，并存储为可检索的日记。

关键约束：**只有回忆性内容才提取为日记**。讲述的必须是过去的事（跨天以上），当天的事情不记录。

## What

实现一个自动化的日记提取系统，通过 Hook 机制集成到主对话流中：

1. **回忆识别**：使用 LLM 判断用户消息是否包含回忆性内容（过去的事，跨天以上）
2. **累积与提炼**：不是每条消息都提取，而是累积一段讲述完成后提炼
3. **结构化输出**：提炼为包含 事件时间、记录时间、内容、人物、地点、情感、标签 的结构
4. **用户确认**：提取后展示给用户，用户可以修改/确认/跳过
5. **持久化**：确认后的日记存储到本地文件系统

## AC (Acceptance Criteria)

### 核心功能

- [ ] AC-01：系统能正确识别用户消息是否包含回忆性内容（过去的事，跨天以上）
- [ ] AC-02：非回忆性内容（如今天的事、未来计划、纯技术讨论）不会触发日记提取
- [ ] AC-03：回忆识别支持模糊时间表达（如"去年夏天"、"大三那年"、"那次旅行"）
- [ ] AC-04：系统会累积一段讲述（多条相关消息）后再提炼，而非逐句提取
- [ ] AC-05：提取后的日记包含完整的结构化字段：事件时间、记录时间、内容、人物、地点（可多个）、情感（可多个）、标签
- [ ] AC-06：提取结果以可读格式展示给用户，并等待用户确认/修改/跳过
- [ ] AC-07：用户可以修改提取结果中的任意字段后再确认
- [ ] AC-08：用户确认后，日记通过 S003 的 DiaryRepository 持久化到 SQLite 数据库
- [ ] AC-09：日记提取过程不阻塞主对话流，用户可以继续对话
- [ ] AC-10：系统通过 Hook 机制集成，触发点为 `afterUserMessage`
- [ ] AC-18：支持 headless 模式（`--headless`），日记自动确认保存，无需交互（用于自动化测试）

### 边界情况

- [ ] AC-11：当用户消息同时包含回忆和非回忆内容时，只提取回忆部分
- [ ] AC-12：当用户拒绝确认某条日记时，该条日记不被存储，且不影响后续提取
- [ ] AC-13：当时间信息完全缺失时，系统能标记为"时间未知"并继续提取
- [ ] AC-14：当用户在同一段对话中讲述多个独立回忆时，系统应分别提取
- [ ] AC-15：当提取失败（如 LLM 返回格式错误）时，系统优雅降级，不影响主对话

### 性能约束

- [ ] AC-16：单次日记提取（含用户确认）不超过 30 秒
- [ ] AC-17：日记提取的 LLM 调用不超过 2 次（识别 + 提炼）

## Dependencies

### D003 — 日记结构定义

日记必须遵循以下类型定义：

```typescript
interface DiaryEntry {
  eventTime: Date | null;        // 用户回忆的那个时间
  recordTime: Date;              // 提取时间
  content: string;               // 提炼后的内容
  people?: string[];             // 相关人物
  locations?: string[];          // 地点（可多个）
  emotions?: string[];          // 情感标签（可多个）
  tags?: string[];               // 自定义标签
}
```

### D004 — Hook 机制

通过 `DiaryExtractHook` 实现，触发点为 `afterUserMessage`：

```typescript
interface DiaryExtractHook {
  afterUserMessage(ctx: ConversationContext): Promise<void>;
}
```

## Implementation Plan

### Phase 1: 核心提取逻辑

1. **`src/diary/prompts.ts`** — LLM prompt 模板
   - 回忆识别 prompt
   - 结构化提取 prompt
2. **`src/diary/types.ts`** — 类型定义
   - 扩展 D003 的 `DiaryEntry`
   - 提取状态枚举
3. **`src/diary/extractor.ts`** — 提取逻辑
   - `isRecall()` — 判断是否为回忆
   - `extract()` — 结构化提取
   - `accumulate()` — 累积讲述

### Phase 2: Hook 实现

4. **`src/hooks/diary-extract.ts`** — DiaryExtractHook 实现
   - 实现 `afterUserMessage` 接口
   - 协调识别 → 累积 → 提炼 → 确认 → 持久化

### Phase 3: 交互与持久化

5. **`src/diary/ui.ts`** — 用户交互
   - 展示提取结果
   - 收集用户确认/修改
6. 集成 S003 的 DiaryRepository 进行持久化
   - 调用 `DiaryRepository.save()` 保存确认后的日记

## 关键文件

```
src/
  hooks/
    diary-extract.ts       # DiaryExtractHook 实现
  diary/
    types.ts               # DiaryEntry 等类型定义
    extractor.ts           # 提取逻辑（调用 LLM）
    prompts.ts             # LLM prompt 模板
    ui.ts                  # 用户交互（确认/修改）
  storage/
    diary-repository.ts    # 由 S003 提供，用于持久化
```

## 设计决策

### 为什么在 `afterUserMessage` 触发？

- 此时用户的完整输入已接收，可以判断是否为回忆
- 不阻塞主对话流，提取是异步的
- 可以在用户继续输入时后台处理

### 为什么需要累积机制？

- 用户的回忆往往分散在多条消息中
- 逐句提取会导致碎片化，提炼质量差
- 累积完整讲述后提炼，能形成更连贯的日记

### 为什么需要用户确认？

- LLM 提取可能不准确（时间、人物等）
- 用户可能不想记录某些回忆（隐私）
- 确认过程让用户有控制感，建立信任

### Headless 模式

Headless 模式（`--headless`）用于自动化测试和批处理场景：
- 从 stdin 逐行读取输入，无需交互式终端
- 日记自动确认保存，跳过用户确认步骤
- 输出使用 `console.log`，格式简洁
- 适用于 CI/CD 或脚本自动化

## Testing Strategy

1. **单元测试**
   - `isRecall()` 的各种输入（回忆/非回忆/边界）
   - `extract()` 的格式解析（正确/错误/缺失字段）
   - `accumulate()` 的累积逻辑

2. **集成测试**
   - 完整提取流程（识别 → 累积 → 提炼 → 确认 → 持久化）
   - Hook 与主循环的集成

3. **手动测试场景**
   - 讲述一段完整回忆，验证提取正确性
   - 混合回忆和非回忆内容，验证只提取回忆
   - 模糊时间表达，验证识别能力
   - 拒绝确认，验证不影响后续

## Success Metrics

- 回忆识别准确率 > 90%（主观评估）
- 提取字段完整率 > 95%（事件时间、内容必填，其他可选）
- 用户确认率 > 80%（说明提取质量足够）
- 端到端提取延迟 < 30 秒
