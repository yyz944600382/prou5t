---
title: S003 — 日记存储
status: Proposed
author: prou5t team
created: 2026-06-02
---

## Why

prou5t 的核心价值是帮助用户永久保存回忆。日记一旦被 Agent 提炼，就必须可靠地持久化到本地存储，并支持高效的检索。S003 定义日记的存储层实现，确保：

- **持久化**：日记不因进程退出而丢失
- **可检索**：按时间、标签、人物、地点等维度快速查询
- **可维护**：支持修改和删除
- **可扩展**：为后续向量检索预留接口

## What

实现基于 SQLite 的日记存储层，提供完整的 CRUD 操作。

### 功能范围

1. **数据库初始化**：首次运行时自动创建 SQLite 数据库和日记表
2. **日记持久化**：将 Agent 提炼的日记保存到数据库
3. **日记查询**：支持按 ID、时间范围、标签、人物、地点等条件查询
4. **日记更新**：支持修改日记内容、标签等字段
5. **日记删除**：支持删除单条日记
6. **数据目录**：所有数据文件存放在 `data/` 目录下

### 技术选型

- **数据库**：SQLite 3（通过 better-sqlite3）
- **JSON 存储**：人物、地点、情感、标签等数组字段以 JSON 字符串存储
- **索引**：为常用查询字段建立索引（event_date, created_at）

## Acceptance Criteria

- [ ] **AC-01**：首次运行时，自动在 `data/` 目录创建 `prou5t.db` 文件
- [ ] **AC-02**：diaries 表包含所有必需字段（id, event_date, created_at, content, people, locations, emotions, tags, updated_at）
- [ ] **AC-03**：为 event_date 和 created_at 字段建立索引
- [ ] **AC-04**：DiaryRepository.save() 成功保存一条日记，返回生成的 ID
- [ ] **AC-05**：DiaryRepository.findById() 根据 ID 返回日记，不存在时返回 null
- [ ] **AC-06**：DiaryRepository.list() 支持按时间范围筛选（startDate, endDate）
- [ ] **AC-07**：DiaryRepository.list() 支持按标签筛选（tags 参数）
- [ ] **AC-08**：DiaryRepository.list() 支持按人物筛选（people 参数）
- [ ] **AC-09**：DiaryRepository.list() 支持按地点筛选（locations 参数）
- [ ] **AC-10**：DiaryRepository.update() 成功更新已存在的日记内容
- [ ] **AC-11**：DiaryRepository.delete() 成功删除已存在的日记
- [ ] **AC-12**：JSON 字段（people, locations, emotions, tags）正确序列化和反序列化
- [ ] **AC-13**：空数据库查询时返回空数组而非抛出错误
- [ ] **AC-14**：updated_at 字段在创建和更新时自动维护

## Dependencies

- **S001**：项目骨架（已实现）
- **S002**：日记结构定义（即将实现）
  - 依赖 `src/diary/types.ts` 中的 `DiaryEntry` 类型
- **D001**：存储技术栈决策（已确定 SQLite）

## Schema

### diaries 表

```sql
CREATE TABLE IF NOT EXISTS diaries (
  id TEXT PRIMARY KEY,
  event_date TEXT,          -- ISO 日期（YYYY-MM-DD），用户回忆的时间
  created_at TEXT NOT NULL, -- ISO 时间戳（YYYY-MM-DDTHH:mm:ss.sssZ），记录创建时间
  content TEXT NOT NULL,    -- 日记完整内容
  people TEXT,              -- JSON 数组，涉及的人物
  locations TEXT,           -- JSON 数组，涉及的地点
  emotions TEXT,            -- JSON 数组，情感标签
  tags TEXT,                -- JSON 数组，其他标签
  updated_at TEXT           -- ISO 时间戳，最后修改时间
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_diaries_event_date ON diaries(event_date);
CREATE INDEX IF NOT EXISTS idx_diaries_created_at ON diaries(created_at);
```

### JSON 字段格式

```json
{
  "people": ["张三", "李四"],
  "locations": ["北京", "故宫"],
  "emotions": ["开心", "怀念"],
  "tags": ["旅行", "家庭聚会"]
}
```

## Key Files

### 新增文件

```
src/
  storage/
    database.ts          # SQLite 连接管理，建表逻辑
    diary-repository.ts  # DiaryRepository 类，CRUD 操作
  diary/
    types.ts             # DiaryEntry 类型定义（与 S002 共享）
```

### 文件职责

#### `src/storage/database.ts`

- `initDatabase()`：创建数据库连接，初始化表结构
- `getDb()`：获取数据库连接单例
- `closeDatabase()`：关闭连接（用于测试清理）

#### `src/storage/diary-repository.ts`

- `DiaryRepository` 类：
  - `save(diary: Omit<DiaryEntry, 'id'>): string` — 保存日记，返回 ID
  - `findById(id: string): DiaryEntry | null` — 按 ID 查询
  - `list(filter?: DiaryFilter): DiaryEntry[]` — 按条件列表查询
  - `update(id: string, updates: Partial<DiaryEntry>): boolean` — 更新日记
  - `delete(id: string): boolean` — 删除日记

#### `src/diary/types.ts`

```typescript
export interface DiaryEntry {
  id: string;
  eventDate?: string;     // YYYY-MM-DD
  createdAt: string;      // ISO timestamp
  content: string;
  people?: string[];
  locations?: string[];
  emotions?: string[];
  tags?: string[];
  updatedAt?: string;
}

export interface DiaryFilter {
  startDate?: string;     // YYYY-MM-DD
  endDate?: string;       // YYYY-MM-DD
  tags?: string[];        // OR 匹配
  people?: string[];      // OR 匹配
  locations?: string[];   // OR 匹配
  limit?: number;
}
```

## Implementation Notes

### ID 生成

使用 `crypto.randomUUID()` 生成唯一 ID（Node.js ≥ 20 内置）。

### 时间戳格式

统一使用 ISO 8601 格式：
- 日期：`YYYY-MM-DD`
- 时间戳：`YYYY-MM-DDTHH:mm:ss.sssZ`

### JSON 查询

SQLite 的 JSON 查询较复杂，初期实现为：
- 保存时将数组序列化为 JSON 字符串
- 查询时读取全量记录，在内存中过滤
- 后续（S006 向量检索）可考虑使用 JSON1 扩展或迁移到专用向量数据库

### 目录结构

```
prou5t/
  data/
    prou5t.db           # SQLite 数据库文件（gitignore）
  src/
    storage/
      ...
```

### 测试策略

- 单元测试覆盖所有 CRUD 操作
- 使用临时数据库进行测试（每个测试独立文件）
- 测试边界情况：空数据库、重复 ID、无效 JSON

## Out of Scope

- **向量检索**：留待 S006
- **增量备份**：留待后续优化
- **数据迁移**：初期 schema 固定，变更需手动处理
- **并发控制**：单进程 CLI，暂不考虑写锁
