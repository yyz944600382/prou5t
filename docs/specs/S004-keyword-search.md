---
title: S004 — 关键词检索
status: Proposed
author: prou5t team
created: 2026-06-03
---

## Why

prou5t 的核心价值是帮助用户永久保存回忆，而保存的目的是为了日后能快速找回。当用户想查找某段回忆时，最自然的方式是"关键词搜索"——比如"那年在巴黎"、"关于奶奶的日记"等。

S004 实现基于关键词的全文检索能力，确保用户能通过简单、直观的查询快速定位目标日记。

关键约束：
- **中文支持**：中文文本没有天然空格分隔，需要分词处理
- **多字段搜索**：用户可能搜索内容、标签、人物、地点任一字段
- **相关度排序**：结果应按匹配程度排序，而非简单的时间排序
- **高亮显示**：用户需要一眼看到匹配位置，快速判断是否为目标日记

## What

实现基于 SQLite FTS5 的全文搜索系统，提供高效的关键词检索能力。

### 功能范围

1. **FTS5 索引创建**：为 diaries 表的 content、tags、people、locations 字段建立全文索引
2. **中文分词支持**：集成分词器，支持中文文本的索引和查询
3. **搜索接口**：提供统一的搜索 API，输入关键词，返回匹配日记列表
4. **相关度排序**：利用 FTS5 的内置排序算法，按匹配度排序结果
5. **高亮显示**：在返回结果中标记匹配的关键词位置
6. **模糊匹配**：支持简单的模糊查询（如前缀匹配、通配符）

### 技术选型

- **全文索引**：SQLite FTS5（FTS5 是 SQLite 的最新全文搜索扩展）
- **中文分词**：
  - 方案 A（推荐）：使用 `simple` tokenizer + ICU 分词（SQLite 编译时启用 ICU 支持）
  - 方案 B：使用 `jieba-js` 进行应用层分词，存储分词结果
  - 方案 C：使用 `porter` tokenizer（对中文效果有限）
- **高亮显示**：使用 FTS5 的 `snippet()` 或 `highlight()` 函数

## Acceptance Criteria

### 核心功能

- [ ] **AC-01**：为 diaries 表创建 FTS5 虚拟表，包含 content、tags、people、locations 字段
- [ ] **AC-02**：FTS5 表与主表保持同步（INSERT/UPDATE/DELETE 操作自动同步）
- [ ] **AC-03**：支持中文关键词搜索（如"巴黎旅行"能匹配"那年在巴黎的旅行"）
- [ ] **AC-04**：搜索接口 `SearchRepository.search(keyword)` 返回匹配的日记列表
- [ ] **AC-05**：搜索结果按 FTS5 的相关度排序（bm25 算法）
- [ ] **AC-06**：返回结果包含高亮信息，标记匹配关键词的位置
- [ ] **AC-07**：支持多关键词查询（空格分隔，AND 逻辑）
- [ ] **AC-08**：支持短语查询（用引号包裹，精确匹配）
- [ ] **AC-09**：支持前缀查询（如"巴黎*"匹配"巴黎旅行"、"巴黎美食"）
- [ ] **AC-10**：空查询或空结果时返回空数组而非抛出错误

### 边界情况

- [ ] **AC-11**：搜索词包含特殊字符（如单引号、双引号）时正确转义
- [ ] **AC-12**：搜索词为纯标点符号时返回空结果
- [ ] **AC-13**：高亮显示时正确处理多语言混排（中英文混合）
- [ ] **AC-14**：当 FTS5 表与主表不同步时（如异常中断），提供重建索引的方法
- [ ] **AC-15**：超长查询（>100 字符）时优雅降级或截断

### 性能约束

- [ ] **AC-16**：单次搜索响应时间 < 500ms（1000 条日记规模）
- [ ] **AC-17**：索引重建时间 < 5 秒（1000 条日记规模）
- [ ] **AC-18**：FTS5 索引文件大小不超过主表的 50%

## Dependencies

- **S001**：项目骨架（已实现）
- **S002**：日记结构定义（已实现）
  - 依赖 `src/diary/types.ts` 中的 `DiaryEntry` 类型
- **S003**：日记存储（已实现）
  - 依赖 `src/storage/diary-repository.ts` 中的 `DiaryRepository`
  - diaries 表必须在 FTS5 建立前存在

## Schema

### FTS5 表结构

```sql
-- FTS5 虚拟表
CREATE VIRTUAL TABLE IF NOT EXISTS diaries_fts USING fts5(
  content,
  tags,
  people,
  locations,
  content='diaries',     -- 关联主表
  content_rowid='rowid'   -- 关联主表行 ID
);

-- 触发器：INSERT 时同步
CREATE TRIGGER IF NOT EXISTS diaries_fts_insert AFTER INSERT ON diaries BEGIN
  INSERT INTO diaries_fts(rowid, content, tags, people, locations)
  VALUES (new.rowid, new.content, new.tags, new.people, new.locations);
END;

-- 触发器：UPDATE 时同步
CREATE TRIGGER IF NOT EXISTS diaries_fts_update AFTER UPDATE ON diaries BEGIN
  UPDATE diaries_fts
  SET content = new.content, tags = new.tags, people = new.people, locations = new.locations
  WHERE rowid = new.rowid;
END;

-- 触发器：DELETE 时同步
CREATE TRIGGER IF NOT EXISTS diaries_fts_delete AFTER DELETE ON diaries BEGIN
  DELETE FROM diaries_fts WHERE rowid = old.rowid;
END;
```

### 中文分词方案

#### 方案 A：ICU Tokenizer（推荐）

```sql
-- 建表时指定 ICU tokenizer
CREATE VIRTUAL TABLE IF NOT EXISTS diaries_fts USING fts5(
  content,
  tags,
  people,
  locations,
  tokenize = 'icu zh_CN'
);
```

**优势**：原生支持、性能好、无需应用层处理
**劣势**：需要 SQLite 编译时启用 ICU 支持

#### 方案 B：应用层分词

如果 SQLite 不支持 ICU，在应用层使用 `nodejieba` 进行分词：

1. **存储时**：将分词结果存入额外字段 `content_tokens`
2. **查询时**：对查询词分词，构建 FTS5 查询

```typescript
import jieba from 'nodejieba';

// 存储时分词
const tokens = jieba.cut(diary.content);
diary.content_tokens = tokens.join(' ');

// 查询时分词
const queryTokens = jieba.cut(keyword);
const ftsQuery = queryTokens.join(' OR ');
```

## Key Files

### 新增文件

```
src/
  search/
    search-repository.ts  # SearchRepository 类，搜索逻辑
    search-index.ts       # FTS5 索引创建、同步、重建
    highlight.ts          # 高亮显示逻辑
```

### 修改文件

```
src/
  storage/
    database.ts           # 添加 FTS5 建表逻辑
```

### 文件职责

#### `src/search/search-index.ts`

- `initSearchIndex()`：创建 FTS5 虚拟表和同步触发器
- `rebuildSearchIndex()`：清空并重建索引（用于修复不同步）
- `syncIndex()`：增量同步（如有需要）

#### `src/search/search-repository.ts`

```typescript
export interface SearchQuery {
  keyword: string;         // 搜索关键词
  limit?: number;          // 返回数量限制
  offset?: number;         // 分页偏移
}

export interface SearchResult {
  diary: DiaryEntry;       // 匹配的日记
  highlights: {            // 高亮信息
    content?: string;      // content 字段的高亮片段
    tags?: string;         // tags 字段的高亮片段
    people?: string;
    locations?: string;
  };
  rank: number;            // FTS5 相关系数
}

export class SearchRepository {
  constructor(private db: Database) {}

  search(query: SearchQuery): Promise<SearchResult[]>;
}
```

#### `src/search/highlight.ts`

- `generateHighlights()`：调用 FTS5 的 `highlight()` 函数生成高亮片段
- `formatHighlight()`：将高亮片段格式化为用户友好的显示

## Implementation Notes

### FTS5 查询语法

- **简单查询**：`巴黎旅行` → 匹配"巴黎"或"旅行"（OR 逻辑）
- **AND 查询**：`巴黎 AND 旅行` → 同时包含两个词
- **短语查询**：`"巴黎旅行"` → 精确匹配短语
- **前缀查询**：`巴黎*` → 匹配"巴黎"开头的词
- **NOT 查询**：`巴黎 NOT 旅行` → 包含"巴黎"但不包含"旅行"

### 高亮实现

使用 FTS5 的 `highlight()` 函数：

```sql
SELECT
  diaries.*,
  highlight(diaries_fts, 0, '[MARK]', '[/MARK]') as content_highlight,
  highlight(diaries_fts, 2, '[MARK]', '[/MARK]') as people_highlight,
  rank
FROM diaries
JOIN diaries_fts ON diaries.rowid = diaries_fts.rowid
WHERE diaries_fts MATCH '巴黎'
ORDER BY rank
LIMIT 20;
```

应用层将 `[MARK]...[/MARK]` 替换为实际的高亮格式（如 ANSI 颜色码或 Markdown）。

### 索引同步策略

1. **触发器同步**（推荐）：通过 SQLite 触发器自动同步
2. **应用层同步**：在 `DiaryRepository` 的 CRUD 方法中手动调用同步

触发器方案更可靠，无需应用层干预。

### 索引重建

当检测到不同步时（如查询结果异常），提供重建方法：

```typescript
async rebuildSearchIndex(): Promise<void> {
  this.db.exec('DELETE FROM diaries_fts');
  this.db.exec(`
    INSERT INTO diaries_fts(rowid, content, tags, people, locations)
    SELECT rowid, content, tags, people, locations FROM diaries
  `);
}
```

## Testing Strategy

### 单元测试

- FTS5 建表逻辑（表结构、触发器）
- 搜索查询的 SQL 生成（各种查询类型）
- 高亮片段的格式化

### 集成测试

- 端到端搜索流程（插入日记 → 搜索 → 验证结果）
- 索引同步测试（INSERT/UPDATE/DELETE 后搜索结果正确）
- 中文分词效果测试

### 手动测试场景

- 搜索"巴黎"，验证返回包含"巴黎"的日记
- 搜索"巴黎 AND 旅行"，验证同时包含两个词
- 搜索"奶奶"，验证高亮正确标记
- 搜索不存在的词，验证返回空数组
- 修改日记后立即搜索，验证索引同步

## Success Metrics

- 搜索准确率 > 90%（前 10 条结果相关度主观评估）
- 搜索响应时间 < 500ms（1000 条日记）
- 中文分词覆盖率 > 95%（常见中文词汇能正确分词）
- 索引同步成功率 100%（无不同步情况）

## CLI Integration

### 搜索入口

在 CLI 主循环中添加搜索命令：

```typescript
// 输入格式 1: /search 关键词
// 输入格式 2: s 关键词（简写）
// 输入格式 3: 在交互菜单中选择"搜索日记"

if (input.startsWith('/search ') || input.startsWith('s ')) {
  const keywords = input.replace(/^\/(search|s) /, '');
  await handleSearch(keywords);
}
```

### 结果展示

搜索结果格式：

```
找到 3 条相关日记：

[1] 2024-03-15 — 与奶奶的回忆
    今天去看了奶奶，她做了我最爱吃的红烧肉...
    匹配: [奶奶]、[红烧肉]

[2] 2024-02-10 — 春节家庭聚会
    全家人一起过年，奶奶给我们讲了以前的故事...
    匹配: [奶奶]

[3] 2023-12-25 — 童年回忆
    小时候奶奶总是带我去公园玩...
    匹配: [奶奶]

(输入数字查看详情，或输入新的搜索关键词)
```

## Out of Scope

- **语义检索**：留待 S005
- **混合检索**：留待 S006（关键词 + 语义融合排序）
- **搜索建议**：如自动补全、热门搜索词
- **搜索历史**：记录用户的搜索记录
- **高级查询语法**：如布尔运算、字段限定查询
- **跨表搜索**：如搜索用户对话内容（暂只搜索日记）

## Future Considerations

### 性能优化

- **索引压缩**：FTS5 支持 `contentless_delete` 选项减少索引大小
- **查询缓存**：常见查询的缓存机制
- **批量索引**：批量插入时的索引优化

### 功能扩展

- **字段权重**：content 字段的匹配权重高于 tags
- **同义词扩展**：搜索"母亲"时同时搜索"妈妈"、"母上"
- **错别字纠正**：使用 Levenshtein 距离进行模糊匹配
