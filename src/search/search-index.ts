/**
 * FTS5 全文搜索索引工具函数
 * 提供索引状态查询和重建功能
 *
 * 注意：FTS5 索引的创建和同步触发器已在 database.ts 的 createFTSIndex() 中实现
 */

import { getDb } from "../storage/database";

/**
 * FTS5 虚拟表名称
 */
const FTS_TABLE_NAME = "diaries_fts";

/**
 * 重建 FTS5 搜索索引
 * 清空现有索引并从 diaries 表重新填充
 * 用于修复索引不同步问题
 */
export function rebuildSearchIndex(): void {
  const db = getDb();

  // 清空 FTS 索引
  db.exec(`DELETE FROM ${FTS_TABLE_NAME};`);

  // 从 diaries 表重新填充索引
  db.exec(`
    INSERT INTO ${FTS_TABLE_NAME}(rowid, content, tags, people, locations)
    SELECT rowid, content, tags, people, locations FROM diaries;
  `);
}

/**
 * 检查 FTS 索引是否存在
 */
export function searchIndexExists(): boolean {
  const db = getDb();
  const stmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  );
  const result = stmt.get(FTS_TABLE_NAME);
  return result !== undefined;
}

/**
 * 获取 FTS 索引中的记录数
 */
export function getSearchIndexCount(): number {
  const db = getDb();
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM ${FTS_TABLE_NAME}`);
  const result = stmt.get() as { count: number };
  return result.count;
}

/**
 * 检查 FTS5 是否可用
 */
export function isFTSAvailable(): boolean {
  const db = getDb();
  try {
    const result = db
      .prepare("SELECT name FROM pragma_compile_options WHERE name='ENABLE_FTS5'")
      .get() as { name: string } | undefined;
    return !!result;
  } catch {
    return false;
  }
}
