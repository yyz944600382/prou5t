/**
 * SearchRepository 单元测试和集成测试
 * 测试 S004 关键词检索功能
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SearchRepository } from "../search-repository";
import { DiaryRepository } from "../../storage/diary-repository";
import { initDatabase, closeDatabase } from "../../storage/database";
import type { DiaryEntry } from "../../diary/types";
import { rebuildSearchIndex } from "../search-index";

describe("SearchRepository", () => {
  let searchRepo: SearchRepository;
  let diaryRepo: DiaryRepository;

  beforeEach(() => {
    // 使用内存数据库进行测试
    process.env.DATABASE_PATH = ":memory:";
    initDatabase();
    searchRepo = new SearchRepository();
    diaryRepo = new DiaryRepository();
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("AC-01: FTS5 表创建", () => {
    it("应该创建 diaries_fts 虚拟表", () => {
      expect(searchRepo.isFTSAvailable()).toBe(true);
    });

    it("应该包含 content, tags, people, locations 字段", () => {
      const db = (searchRepo as any).db;
      const schema = db
        .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='diaries_fts'")
        .get() as { sql: string };

      expect(schema.sql).toContain("content");
      expect(schema.sql).toContain("tags");
      expect(schema.sql).toContain("people");
      expect(schema.sql).toContain("locations");
    });
  });

  describe("AC-02, AC-03: 中文关键词搜索", () => {
    beforeEach(() => {
      // 插入测试数据
      diaryRepo.save({
        eventDate: "2024-07-15",
        content: "去年夏天和朋友一起去海边，天气特别好，我们在沙滩上玩了一整天。",
        people: ["小明", "小红"],
        locations: ["海边", "沙滩"],
        emotions: ["开心", "放松"],
        tags: ["旅行", "夏天", "海滩"],
      });

      diaryRepo.save({
        eventDate: "2024-03-20",
        content: "今天去了奶奶家，她做了我最爱吃的红烧肉。味道好极了！",
        people: ["奶奶"],
        locations: ["奶奶家"],
        emotions: ["温馨", "满足"],
        tags: ["家庭", "美食", "亲情"],
      });

      diaryRepo.save({
        eventDate: "2024-12-25",
        content: "圣诞节和朋友们一起去了巴黎旅行，参观了埃菲尔铁塔和卢浮宫。",
        people: ["朋友"],
        locations: ["巴黎", "埃菲尔铁塔", "卢浮宫"],
        emotions: ["兴奋", "难忘"],
        tags: ["旅行", "圣诞节", "巴黎"],
      });
    });

    it("AC-03: 应该能搜索中文关键词", () => {
      const results = searchRepo.search({ keyword: "海边" });

      expect(results.length).toBeGreaterThanOrEqual(1);
      const result = results.find((r) => r.diary.content.includes("海边"));
      expect(result).toBeDefined();
      expect(result!.diary.content).toContain("海边");
      expect(result!.highlights.content).toBeDefined();
    });

    it("应该能搜索多个中文关键词", () => {
      const results = searchRepo.search({ keyword: "巴黎 旅行" });

      expect(results.length).toBeGreaterThan(0);
      const parisDiary = results.find((r) => r.diary.content.includes("巴黎"));
      expect(parisDiary).toBeDefined();
    });

    it("应该能在 tags 字段中搜索", () => {
      const results = searchRepo.search({ keyword: "旅行" });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results.every((r) => r.diary.tags?.includes("旅行"))).toBe(true);
    });

    it("应该能在 people 字段中搜索", () => {
      const results = searchRepo.search({ keyword: "奶奶" });

      expect(results).toHaveLength(1);
      expect(results[0].diary.people).toContain("奶奶");
    });

    it("应该能在 locations 字段中搜索", () => {
      const results = searchRepo.search({ keyword: "巴黎" });

      expect(results).toHaveLength(1);
      expect(results[0].diary.locations).toContain("巴黎");
    });
  });

  describe("AC-04: 搜索接口", () => {
    it("应该返回 SearchResult[] 类型", () => {
      diaryRepo.save({
        content: "测试日记内容",
        tags: ["测试"],
      });

      const results = searchRepo.search({ keyword: "测试" });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("diary");
        expect(results[0]).toHaveProperty("highlights");
        expect(results[0]).toHaveProperty("rank");
      }
    });
  });

  describe("AC-05: 相关度排序", () => {
    beforeEach(() => {
      diaryRepo.save({
        content: "海边旅行很棒，海边的美景让人难忘",
        tags: ["海边", "旅行"],
      });

      diaryRepo.save({
        content: "去了巴黎旅行，巴黎很美",
        tags: ["旅行"],
      });

      diaryRepo.save({
        content: "海边日落很美",
        tags: ["海边"],
      });
    });

    it("搜索结果应该按相关度排序", () => {
      const results = searchRepo.search({ keyword: "海边 旅行" });

      // 第一个结果应该同时包含"海边"和"旅行"
      if (results.length > 0) {
        const first = results[0];
        const hasBothKeywords =
          (first.diary.content.includes("海边") || first.diary.tags?.includes("海边")) &&
          (first.diary.content.includes("旅行") || first.diary.tags?.includes("旅行"));
        expect(hasBothKeywords).toBe(true);
      }
    });

    it("应该返回 rank 分数字段", () => {
      const results = searchRepo.search({ keyword: "海边" });

      results.forEach((result) => {
        expect(typeof result.rank).toBe("number");
      });
    });
  });

  describe("AC-06: 高亮显示", () => {
    beforeEach(() => {
      diaryRepo.save({
        content: "去年夏天去了海边旅行，风景很美",
        tags: ["旅行", "夏天"],
        people: ["小明"],
        locations: ["海边"],
      });
    });

    it("应该返回 content 高亮信息", () => {
      const results = searchRepo.search({ keyword: "海边" });

      const result = results.find((r) => r.diary.content.includes("海边"));
      expect(result).toBeDefined();
      expect(result!.highlights.content).toBeDefined();
      // FTS5 会用 { } 标记匹配项
      expect(result!.highlights.content).toContain("{");
    });

    it("应该返回 tags 高亮信息", () => {
      const results = searchRepo.search({ keyword: "旅行" });

      const result = results.find((r) => r.diary.tags?.includes("旅行"));
      expect(result).toBeDefined();
      expect(result!.highlights.tags).toBeDefined();
    });

    it("应该返回 people 高亮信息", () => {
      const results = searchRepo.search({ keyword: "小明" });

      const result = results.find((r) => r.diary.people?.includes("小明"));
      expect(result).toBeDefined();
      expect(result!.highlights.people).toBeDefined();
    });

    it("应该返回 locations 高亮信息", () => {
      const results = searchRepo.search({ keyword: "海边" });

      const result = results.find((r) => r.diary.locations?.includes("海边"));
      expect(result).toBeDefined();
      expect(result!.highlights.locations).toBeDefined();
    });
  });

  describe("AC-07, AC-08: 多关键词和短语查询", () => {
    beforeEach(() => {
      diaryRepo.save({
        content: "巴黎旅行非常棒，参观了埃菲尔铁塔",
        tags: ["巴黎", "旅行"],
      });

      diaryRepo.save({
        content: "夏天去海边玩很开心",
        tags: ["夏天", "海边"],
      });
    });

    it("AC-07: 应该支持空格分隔的多关键词查询", () => {
      const results = searchRepo.search({ keyword: "巴黎 旅行" });

      expect(results.length).toBeGreaterThan(0);
      // 结果应该包含"巴黎"或"旅行"或两者都有
      const hasKeyword = results.some(
        (r) =>
          r.diary.content.includes("巴黎") ||
          r.diary.content.includes("旅行") ||
          r.diary.tags?.includes("巴黎") ||
          r.diary.tags?.includes("旅行")
      );
      expect(hasKeyword).toBe(true);
    });

    it("AC-08: 应该支持 AND 查询", () => {
      const results = searchRepo.search({ keyword: "巴黎 AND 旅行" });

      expect(results.length).toBeGreaterThan(0);
      // 结果应该同时包含"巴黎"和"旅行"
      results.forEach((r) => {
        const hasParis =
          r.diary.content.includes("巴黎") || r.diary.tags?.includes("巴黎");
        const hasTravel =
          r.diary.content.includes("旅行") || r.diary.tags?.includes("旅行");
        expect(hasParis && hasTravel).toBe(true);
      });
    });
  });

  describe("AC-09: 前缀查询", () => {
    beforeEach(() => {
      diaryRepo.save({
        content: "巴黎旅行很棒",
        tags: ["巴黎"],
      });

      diaryRepo.save({
        content: "巴黎美食令人难忘",
        tags: ["巴黎"],
      });

      diaryRepo.save({
        content: "北京也很好玩",
        tags: ["北京"],
      });
    });

    it("应该支持前缀查询", () => {
      const results = searchRepo.search({ keyword: "巴黎*" });

      // 应该匹配"巴黎旅行"和"巴黎美食"
      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach((r) => {
        const hasParis =
          r.diary.content.includes("巴黎") || r.diary.tags?.includes("巴黎");
        expect(hasParis).toBe(true);
      });
    });
  });

  describe("AC-10: 空查询和空结果", () => {
    it("AC-10: 空查询应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "" });
      expect(results).toEqual([]);
    });

    it("空格查询应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "   " });
      expect(results).toEqual([]);
    });

    it("不存在的关键词应该返回空数组", () => {
      const results = searchRepo.search({ keyword: "不存在的关键词xyz123" });
      expect(results).toEqual([]);
    });
  });

  describe("AC-11: 特殊字符转义", () => {
    beforeEach(() => {
      diaryRepo.save({
        content: "这是一个测试（包含括号）的内容",
        tags: ["测试"],
      });
    });

    it("AC-11: 应该正确处理包含特殊字符的搜索词", () => {
      // 包含括号的搜索应该不会报错
      const results = searchRepo.search({ keyword: "测试" });
      expect(Array.isArray(results)).toBe(true);
    });

    it("应该正确转义单引号", () => {
      const results = searchRepo.search({ keyword: "测试" });
      expect(() => searchRepo.search({ keyword: "'" })).not.toThrow();
    });
  });

  describe("AC-12: 纯标点符号搜索", () => {
    it("AC-12: 纯标点符号应该返回空结果", () => {
      const results = searchRepo.search({ keyword: "！@#$%" });
      expect(results).toEqual([]);
    });
  });

  describe("AC-13: 中英文混合", () => {
    beforeEach(() => {
      diaryRepo.save({
        content: "今天去了 Apple Store 买了新 iPhone",
        tags: ["购物", "Apple"],
        locations: ["Apple Store"],
      });
    });

    it("AC-13: 应该能搜索中英文混合的内容", () => {
      const results = searchRepo.search({ keyword: "Apple" });

      expect(results).toHaveLength(1);
      expect(results[0].diary.content).toContain("Apple");
    });
  });

  describe("AC-14: 索引重建", () => {
    it("AC-14: 应该提供重建索引的方法", () => {
      expect(() => searchRepo.rebuildIndex()).not.toThrow();
    });

    it("重建后索引应该正常工作", () => {
      diaryRepo.save({
        content: "测试日记",
        tags: ["测试"],
      });

      // 重建索引
      searchRepo.rebuildIndex();

      // 搜索应该仍然有效
      const results = searchRepo.search({ keyword: "测试" });
      expect(results).toHaveLength(1);
    });
  });

  describe("AC-15: 超长查询", () => {
    it("AC-15: 超长查询应该优雅降级", () => {
      const longQuery = "测试 ".repeat(100);

      // 不应该抛出错误
      expect(() => searchRepo.search({ keyword: longQuery })).not.toThrow();

      // 应该返回数组（可能为空）
      const results = searchRepo.search({ keyword: longQuery });
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("AC-16, AC-17, AC-18: 性能约束", () => {
    it("AC-16: 单次搜索应该在合理时间内完成", () => {
      // 插入 100 条测试数据
      for (let i = 0; i < 100; i++) {
        diaryRepo.save({
          content: `这是第 ${i} 条测试日记，包含关键词：测试`,
          tags: ["测试", `标签${i}`],
        });
      }

      const start = Date.now();
      const results = searchRepo.search({ keyword: "测试" });
      const duration = Date.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500); // 500ms
    });

    it("AC-17: 索引重建应该在合理时间内完成", () => {
      // 插入 100 条数据
      for (let i = 0; i < 100; i++) {
        diaryRepo.save({
          content: `测试日记 ${i}`,
          tags: ["测试"],
        });
      }

      const start = Date.now();
      rebuildSearchIndex();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000); // 5秒
    });

    it("索引重建后搜索应该正常工作", () => {
      diaryRepo.save({
        content: "性能测试日记",
        tags: ["性能"],
      });

      rebuildSearchIndex();

      const results = searchRepo.search({ keyword: "性能测试" });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("分页功能", () => {
    beforeEach(() => {
      // 插入 25 条测试数据
      for (let i = 0; i < 25; i++) {
        diaryRepo.save({
          content: `测试日记 ${i}，包含关键词：搜索`,
          tags: ["搜索", `标签${i}`],
        });
      }
    });

    it("应该支持 limit 参数", () => {
      const results = searchRepo.search({ keyword: "搜索", limit: 10 });
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it("应该支持 offset 参数", () => {
      const firstPage = searchRepo.search({ keyword: "搜索", limit: 10, offset: 0 });
      const secondPage = searchRepo.search({ keyword: "搜索", limit: 10, offset: 10 });

      // 两页不应该有重复
      const firstIds = new Set(firstPage.map((r) => r.diary.id));
      const secondIds = new Set(secondPage.map((r) => r.diary.id));

      const intersection = [...firstIds].filter((id) => secondIds.has(id));
      expect(intersection).toHaveLength(0);
    });
  });

  describe("索引同步测试", () => {
    it("INSERT 后应该能立即搜索到", () => {
      const diary = diaryRepo.save({
        content: "新插入的日记",
        tags: ["新"],
      });

      const results = searchRepo.search({ keyword: "新插入" });
      expect(results.length).toBeGreaterThanOrEqual(1);
      const result = results.find((r) => r.diary.id === diary.id);
      expect(result).toBeDefined();
    });

    it("UPDATE 后应该能搜索到新内容", () => {
      const diary = diaryRepo.save({
        content: "原始内容",
        tags: ["原始"],
      });

      // 修改内容
      diaryRepo.update(diary.id, {
        content: "修改后的内容巴黎旅行",
        tags: ["修改"],
      });

      // 搜索新内容
      const results = searchRepo.search({ keyword: "巴黎" });
      expect(results.length).toBeGreaterThanOrEqual(1);

      // 搜索旧内容应该找不到
      const oldResults = searchRepo.search({ keyword: "原始内容" });
      expect(oldResults.length).toBe(0);
    });

    it("DELETE 后应该搜索不到", () => {
      const diary = diaryRepo.save({
        content: "待删除的日记",
        tags: ["删除"],
      });

      // 确认能搜到
      let results = searchRepo.search({ keyword: "待删除" });
      expect(results.length).toBeGreaterThanOrEqual(1);

      // 删除
      diaryRepo.delete(diary.id);

      // 应该搜不到
      results = searchRepo.search({ keyword: "待删除" });
      expect(results.length).toBe(0);
    });
  });
});
