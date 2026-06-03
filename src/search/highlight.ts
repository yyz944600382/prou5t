/**
 * 高亮显示工具
 * 将 FTS5 返回的高亮标记格式化为用户友好的显示
 */

import type { SearchHighlights } from "./types";

/**
 * 高亮标记的默认格式
 * 使用 \x01 \x02 作为标记，不会与正常文本冲突
 */
const MARK_START = "\x01";
const MARK_END = "\x02";

/**
 * 生成带高亮的文本片段
 *
 * @param text - 原始文本
 * @param keyword - 关键词（用于简单回退高亮）
 * @param ftsHighlight - FTS5 返回的高亮文本（带 { } 标记）
 * @returns 带高亮标记的文本
 */
export function generateHighlight(
  text: string,
  keyword: string,
  ftsHighlight?: string
): string {
  // 如果 FTS5 已经返回高亮结果，直接使用
  if (ftsHighlight && ftsHighlight.includes("\x01")) {
    return ftsHighlight;
  }

  // 简单回退：直接在文本中标记关键词
  if (!keyword) {
    return text;
  }

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
 * 格式化高亮文本用于终端显示
 * 将 { } 标记替换为 ANSI 颜色码
 *
 * @param text - 带高亮标记的文本
 * @returns 格式化后的文本（带 ANSI 颜色码）
 */
export function formatHighlightForTerminal(text: string): string {
  // 使用 ANSI 颜色码：黄色高亮
  const ANSI_HIGHLIGHT = "\x1b[33m\x1b[1m"; // 黄色 + 加粗
  const ANSI_RESET = "\x1b[0m";

  return text
    .replaceAll(MARK_START, ANSI_HIGHLIGHT)
    .replaceAll(MARK_END, ANSI_RESET);
}

/**
 * 格式化高亮文本用于 Markdown 显示
 * 将 { } 标记替换为 Markdown 加粗语法
 *
 * @param text - 带高亮标记的文本
 * @returns 格式化后的文本（Markdown 格式）
 */
export function formatHighlightForMarkdown(text: string): string {
  return text
    .replaceAll(MARK_START, "**")
    .replaceAll(MARK_END, "**");
}

/**
 * 生成搜索结果的高亮摘要
 * 提取包含匹配关键词的上下文片段
 *
 * @param text - 原始文本
 * @param keyword - 关键词
 * @param contextLength - 上下文长度（默认 80 字符）
 * @returns 摘要文本
 */
export function generateSnippet(
  text: string,
  keyword: string,
  contextLength: number = 80
): string {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const index = lowerText.indexOf(lowerKeyword);

  if (index === -1) {
    // 如果没找到关键词，返回文本开头
    return text.slice(0, contextLength) + (text.length > contextLength ? "..." : "");
  }

  // 计算片段的起始和结束位置
  const halfLength = Math.floor(contextLength / 2);
  let start = Math.max(0, index - halfLength);
  let end = Math.min(text.length, index + keyword.length + halfLength);

  // 添加省略号
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  const snippet = text.slice(start, end);
  return `${prefix}${snippet}${suffix}`;
}

/**
 * 格式化所有高亮字段
 * 将 SearchHighlights 中的所有字段格式化为终端显示格式
 *
 * @param highlights - 高亮信息
 * @returns 格式化后的高亮信息
 */
export function formatAllHighlights(highlights: SearchHighlights): Record<string, string> {
  const result: Record<string, string> = {};

  if (highlights.content) {
    result.content = formatHighlightForTerminal(highlights.content);
  }
  if (highlights.tags) {
    result.tags = formatHighlightForTerminal(highlights.tags);
  }
  if (highlights.people) {
    result.people = formatHighlightForTerminal(highlights.people);
  }
  if (highlights.locations) {
    result.locations = formatHighlightForTerminal(highlights.locations);
  }

  return result;
}
