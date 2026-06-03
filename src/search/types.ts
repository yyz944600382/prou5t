/**
 * 搜索相关类型定义
 */

import type { DiaryEntry } from "../diary/types";

/**
 * 搜索查询参数
 */
export interface SearchQuery {
  /** 搜索关键词 */
  keyword: string;
  /** 返回数量限制 */
  limit?: number;
  /** 分页偏移 */
  offset?: number;
}

/**
 * 搜索结果高亮信息
 */
export interface SearchHighlights {
  /** content 字段的高亮片段 */
  content?: string;
  /** tags 字段的高亮片段 */
  tags?: string;
  /** people 字段的高亮片段 */
  people?: string;
  /** locations 字段的高亮片段 */
  locations?: string;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 匹配的日记 */
  diary: DiaryEntry;
  /** 高亮信息 */
  highlights: SearchHighlights;
  /** FTS5 相关系数（越小越相关） */
  rank: number;
}
