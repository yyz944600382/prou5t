/**
 * highlight 工具函数测试
 * 测试高亮显示、格式化功能
 */

import { describe, it, expect } from "vitest";
import {
  generateHighlight,
  formatHighlightForTerminal,
  formatHighlightForMarkdown,
  generateSnippet,
  formatAllHighlights,
} from "../highlight";
import type { SearchHighlights } from "../types";

describe("highlight", () => {
  describe("generateHighlight", () => {
    it("应该使用 FTS 返回的高亮结果", () => {
      const ftsHighlight = "这是\x01测试\x02内容";
      const result = generateHighlight("这是测试内容", "测试", ftsHighlight);

      expect(result).toContain("\x01");
    });

    it("FTS 高亮没有标记时应该使用简单回退", () => {
      const result = generateHighlight("这是测试内容", "测试", undefined);

      expect(result).toContain("\x01");
      expect(result).toContain("\x02");
    });

    it("简单回退应该正确标记关键词位置", () => {
      const result = generateHighlight("Hello World", "World", undefined);

      expect(result).toBe("Hello \x01World\x02");
    });

    it("找不到关键词时应该返回原文", () => {
      const result = generateHighlight("Hello World", "Python", undefined);

      expect(result).toBe("Hello World");
    });

    it("空关键词时应该返回原文", () => {
      const result = generateHighlight("Hello World", "", undefined);

      expect(result).toBe("Hello World");
    });

    it("应该处理大小写不敏感的匹配", () => {
      const result = generateHighlight("Hello World", "world", undefined);

      expect(result).toBe("Hello \x01World\x02");
    });

    it("应该只标记第一个匹配项", () => {
      const result = generateHighlight("test test test", "test", undefined);

      // 简单回退只标记第一个匹配
      expect(result).toBe("\x01test\x02 test test");
    });
  });

  describe("formatHighlightForTerminal", () => {
    it("应该将 \\x01 \\x02 替换为 ANSI 颜色码", () => {
      const text = "这是\x01测试\x02内容";
      const formatted = formatHighlightForTerminal(text);

      expect(formatted).toContain("\x1b["); // ANSI 转义码
      expect(formatted).toContain("33m"); // 黄色
    });

    it("应该移除所有高亮标记", () => {
      const text = "这是\x01测试\x02内容";
      const formatted = formatHighlightForTerminal(text);

      expect(formatted).not.toContain("\x01");
      expect(formatted).not.toContain("\x02");
    });
  });

  describe("formatHighlightForMarkdown", () => {
    it("应该将 \\x01 \\x02 替换为 Markdown 加粗", () => {
      const text = "这是\x01测试\x02内容";
      const formatted = formatHighlightForMarkdown(text);

      expect(formatted).toContain("**测试**");
      expect(formatted).not.toContain("\x01");
      expect(formatted).not.toContain("\x02");
    });

    it("应该正确处理多个高亮标记", () => {
      const text = "\x01第一个\x02 和 \x01第二个\x02";
      const formatted = formatHighlightForMarkdown(text);

      expect(formatted).toBe("**第一个** 和 **第二个**");
    });
  });

  describe("generateSnippet", () => {
    it("应该提取包含关键词的上下文片段", () => {
      const text = "这是一段很长的文本，中间包含关键词测试，后面还有很多内容";
      const snippet = generateSnippet(text, "关键词", 20);

      expect(snippet).toContain("关键词");
      // Snippet includes prefix/suffix which can add length
      expect(snippet.length).toBeLessThan(50);
    });

    it("找不到关键词时应该返回文本开头", () => {
      const text = "这是一段很长的文本内容";
      const snippet = generateSnippet(text, "不存在", 10);

      expect(snippet).toMatch(/^这.+?\.\.\.$/);
    });

    it("短文本应该不添加省略号", () => {
      const text = "短文本";
      const snippet = generateSnippet(text, "短", 20);

      expect(snippet).toBe("短文本");
    });

    it("关键词在开头时应该正确处理", () => {
      const text = "关键词在文本的开头位置";
      const snippet = generateSnippet(text, "关键词", 10);

      expect(snippet).toContain("关键词");
    });

    it("关键词在结尾时应该正确处理", () => {
      const text = "文本的结尾位置是关键词";
      const snippet = generateSnippet(text, "关键词", 10);

      expect(snippet).toContain("关键词");
    });

    it("应该添加前缀省略号", () => {
      const longText = "前面很多内容 ".repeat(10) + "关键词在这里";
      const snippet = generateSnippet(longText, "关键词", 20);

      expect(snippet).toMatch(/^\.\.\./);
    });

    it("应该添加后缀省略号", () => {
      const longText = "关键词在这里" + " 后面很多内容".repeat(10);
      const snippet = generateSnippet(longText, "关键词", 20);

      expect(snippet).toMatch(/\.\.\.$/);
    });
  });

  describe("formatAllHighlights", () => {
    it("应该格式化所有高亮字段", () => {
      const highlights: SearchHighlights = {
        content: "这是\x01测试\x02内容",
        tags: "\x01标签\x02",
        people: "\x01人物\x02",
        locations: "\x01地点\x02",
      };

      const formatted = formatAllHighlights(highlights);

      expect(formatted).toHaveProperty("content");
      expect(formatted).toHaveProperty("tags");
      expect(formatted).toHaveProperty("people");
      expect(formatted).toHaveProperty("locations");

      // 所有字段都应该包含 ANSI 码
      Object.values(formatted).forEach((value) => {
        expect(value).toContain("\x1b[");
      });
    });

    it("应该只格式化存在的字段", () => {
      const highlights: SearchHighlights = {
        content: "内容",
      };

      const formatted = formatAllHighlights(highlights);

      expect(formatted).toHaveProperty("content");
      expect(formatted).not.toHaveProperty("tags");
    });

    it("空对象应该返回空对象", () => {
      const highlights: SearchHighlights = {};
      const formatted = formatAllHighlights(highlights);

      expect(Object.keys(formatted)).toHaveLength(0);
    });
  });
});
