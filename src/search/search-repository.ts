/**
 * 搜索仓储
 * 提供关键词搜索功能
 */

import Database from "better-sqlite3";
import type { SearchQuery, SearchResult } from "./types";
import type { DiaryEntry } from "../diary/types";
import { getDb } from "../storage/database";
import { buildTokenizedFTSQuery } from "./tokenizer";

/**
 * 高亮标记常量（与 highlight.ts 保持一致）
 * 使用 \x01 \x02 作为标记，不会与正常文本冲突
 */
const MARK_START = "\x01";
const MARK_END = "\x02";

/**
 * 构建高亮 SQL
 */
function buildHighlightSQL(
  fieldIndex: number,
  openMark: string = MARK_START,
  closeMark: string = MARK_END
): string {
  return `highlight(diaries_fts, ${fieldIndex}, '${openMark}', '${closeMark}')`;
}

/**
 * 搜索仓储类
 */
export class SearchRepository {
  private db: Database.Database;

  constructor() {
    this.db = getDb();
  }

  /**
   * 关键词搜索
   *
   * @param query - 搜索查询参数
   * @returns 搜索结果列表
   */
  search(query: SearchQuery): SearchResult[] {
    const { keyword, limit = 20, offset = 0 } = query;

    // 空查询返回空数组
    if (!keyword || !keyword.trim()) {
      return [];
    }

    const trimmedKeyword = keyword.trim();
    // 构建适配中文分词的 FTS5 查询
    const ftsQuery = buildTokenizedFTSQuery(trimmedKeyword);

    // 构建查询 SQL
    const sql = `
      SELECT
        d.*,
        ${buildHighlightSQL(0)} as content_highlight,
        ${buildHighlightSQL(1)} as tags_highlight,
        ${buildHighlightSQL(2)} as people_highlight,
        ${buildHighlightSQL(3)} as locations_highlight,
        diaries_fts.rank
      FROM diaries d
      JOIN diaries_fts ON d.rowid = diaries_fts.rowid
      WHERE diaries_fts MATCH ?
      ORDER BY rank
      LIMIT ? OFFSET ?
    `;

    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(ftsQuery, limit, offset) as Row[];

      return rows.map((row) => this.rowToResult(row, trimmedKeyword));
    } catch (error) {
      // FTS 查询失败（如语法错误），返回空数组
      console.error("[SearchRepository] search error:", error);
      return [];
    }
  }

  /**
   * 检查 FTS5 索引是否可用
   */
  isFTSAvailable(): boolean {
    try {
      // 尝试查询 FTS5 表是否存在
      const result = this.db
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='diaries_fts' LIMIT 1")
        .get();
      return !!result;
    } catch {
      return false;
    }
  }

  /**
   * 重建搜索索引
   * 用于修复索引与主表不同步的情况
   */
  rebuildIndex(): void {
    this.db.exec("DELETE FROM diaries_fts");
    this.db.exec(`
      INSERT INTO diaries_fts(rowid, content, tags, people, locations)
      SELECT rowid, tokenize_chinese(content), tokenize_chinese(tags), tokenize_chinese(people), tokenize_chinese(locations) FROM diaries
    `);
  }

  /**
   * 将数据库行转换为 SearchResult
   * 如果 FTS5 没有生成高亮标记，则在应用层手动添加
   */
  private rowToResult(row: Row, keyword: string): SearchResult {
    const diary: DiaryEntry = {
      id: row.id,
      eventDate: row.event_date ?? undefined,
      createdAt: row.created_at,
      content: row.content,
      people: this.deserializeArray(row.people),
      locations: this.deserializeArray(row.locations),
      emotions: this.deserializeArray(row.emotions),
      tags: this.deserializeArray(row.tags),
      updatedAt: row.updated_at ?? undefined,
    };

    // 检查 FTS5 是否生成了高亮标记，如果没有则手动添加
    const contentHighlight = row.content_highlight && row.content_highlight.includes(MARK_START)
      ? row.content_highlight
      : this.addHighlightMarks(row.content, keyword);

    const tagsHighlight = row.tags_highlight && row.tags_highlight.includes(MARK_START)
      ? row.tags_highlight
      : this.addHighlightMarks(row.tags ?? "", keyword);

    const peopleHighlight = row.people_highlight && row.people_highlight.includes(MARK_START)
      ? row.people_highlight
      : this.addHighlightMarks(row.people ?? "", keyword);

    const locationsHighlight = row.locations_highlight && row.locations_highlight.includes(MARK_START)
      ? row.locations_highlight
      : this.addHighlightMarks(row.locations ?? "", keyword);

    const highlights = {
      content: contentHighlight,
      tags: tagsHighlight,
      people: peopleHighlight,
      locations: locationsHighlight,
    };

    return {
      diary,
      highlights,
      rank: row.rank,
    };
  }

  /**
   * 在文本中手动添加高亮标记
   * 标记所有匹配关键词的位置
   */
  private addHighlightMarks(text: string, keyword: string): string {
    if (!text || !keyword) {
      return text ?? "";
    }

    // 对于中文关键词，标记每个字符的出现
    const hasChinese = /[一-龥]/.test(keyword);
    if (hasChinese) {
      const chineseChars = keyword.match(/[一-龥]/g) ?? [];
      let result = text;
      for (const char of chineseChars) {
        result = result.replaceAll(char, `${MARK_START}${char}${MARK_END}`);
      }
      return result;
    }

    // 对于非中文，标记完整的词
    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKeyword);

    if (index === -1) {
      return text;
    }

    const before = text.slice(0, index);
    const match = text.slice(index, index + keyword.length);
    const after = text.slice(index + keyword.length);

    return `${before}${MARK_START}${match}${MARK_END}${after}`;
  }

  /**
   * JSON 字段反序列化
   */
  private deserializeArray(json: string | null | undefined): string[] | undefined {
    if (!json) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(json);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * 数据库行类型
 */
interface Row {
  id: string;
  event_date: string | null;
  created_at: string;
  content: string;
  people: string | null;
  locations: string | null;
  emotions: string | null;
  tags: string | null;
  updated_at: string | null;
  content_highlight: string | null;
  tags_highlight: string | null;
  people_highlight: string | null;
  locations_highlight: string | null;
  rank: number;
}
