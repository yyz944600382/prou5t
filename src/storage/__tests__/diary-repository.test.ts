/**
 * DiaryRepository 测试
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, rmSync } from "node:fs";
import type { DiaryEntry } from "../../diary/types";
import { DiaryRepository } from "../diary-repository";
import { initDatabase, closeDatabase } from "../database";

describe("DiaryRepository", () => {
  let repo: DiaryRepository;

  beforeAll(() => {
    closeDatabase(); // 确保之前的连接已关闭
    initDatabase("test-data-repo");
    repo = new DiaryRepository();
  });

  afterAll(() => {
    closeDatabase();
    if (existsSync("test-data-repo")) {
      try {
        rmSync("test-data-repo", { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  });

  describe("save", () => {
    it("应该保存日记并返回 ID", () => {
      const diary = {
        eventDate: "2025-03-15",
        createdAt: new Date().toISOString(),
        content: "今天是个好日子",
        people: ["张三", "李四"],
        locations: ["北京"],
        emotions: ["开心"],
        tags: ["聚会"],
      };
      const id = repo.save(diary);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("应该自动生成 created_at 和 updated_at", () => {
      const diary = {
        content: "测试日记",
      };
      const id = repo.save(diary);
      const saved = repo.findById(id);
      expect(saved?.createdAt).toBeDefined();
      expect(saved?.updatedAt).toBeDefined();
    });

    it("应该保存所有字段", () => {
      const diary = {
        eventDate: "2024-01-01",
        createdAt: "2024-01-01T00:00:00.000Z",
        content: "元旦快乐",
        people: ["家人"],
        locations: ["家"],
        emotions: ["温馨"],
        tags: ["节日"],
      };
      const id = repo.save(diary);
      const saved = repo.findById(id);
      expect(saved?.eventDate).toBe("2024-01-01");
      expect(saved?.content).toBe("元旦快乐");
      expect(saved?.people).toEqual(["家人"]);
      expect(saved?.locations).toEqual(["家"]);
      expect(saved?.emotions).toEqual(["温馨"]);
      expect(saved?.tags).toEqual(["节日"]);
    });

    it("应该处理空数组字段", () => {
      const diary = {
        content: "测试",
        people: [],
        locations: [],
      };
      const id = repo.save(diary);
      const saved = repo.findById(id);
      expect(saved?.people).toEqual([]);
      expect(saved?.locations).toEqual([]);
    });
  });

  describe("findById", () => {
    it("应该找到已保存的日记", () => {
      const diary = {
        content: "测试日记",
        tags: ["test"],
      };
      const id = repo.save(diary);
      const found = repo.findById(id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(id);
      expect(found?.content).toBe("测试日记");
    });

    it("不存在的 ID 应该返回 null", () => {
      const found = repo.findById("non-existent-id");
      expect(found).toBeNull();
    });

    it("应该正确反序列化 JSON 字段", () => {
      const diary = {
        content: "测试",
        people: ["张三", "李四"],
        locations: ["北京", "上海"],
        emotions: ["开心", "激动"],
        tags: ["旅行", "美食"],
      };
      const id = repo.save(diary);
      const found = repo.findById(id);
      expect(found?.people).toEqual(["张三", "李四"]);
      expect(found?.locations).toEqual(["北京", "上海"]);
      expect(found?.emotions).toEqual(["开心", "激动"]);
      expect(found?.tags).toEqual(["旅行", "美食"]);
    });
  });

  describe("list", () => {
    beforeAll(() => {
      // 创建测试数据
      repo.save({
        eventDate: "2024-01-01",
        content: "元旦",
        tags: ["节日"],
      });
      repo.save({
        eventDate: "2024-02-14",
        content: "情人节",
        tags: ["浪漫"],
        people: ["爱人"],
      });
      repo.save({
        eventDate: "2024-03-15",
        content: "某天",
        tags: ["旅行"],
        locations: ["巴黎"],
      });
    });

    it("应该返回所有日记", () => {
      const list = repo.list();
      expect(list.length).toBeGreaterThanOrEqual(3);
    });

    it("应该支持按时间范围筛选", () => {
      const list = repo.list({ startDate: "2024-02-01", endDate: "2024-02-29" });
      expect(list.length).toBeGreaterThanOrEqual(1);
      const valentine = list.find((d) => d.content === "情人节");
      expect(valentine).toBeDefined();
    });

    it("应该支持只设置开始日期", () => {
      const list = repo.list({ startDate: "2024-02-01" });
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("应该支持只设置结束日期", () => {
      const list = repo.list({ endDate: "2024-01-31" });
      const newYear = list.find((d) => d.content === "元旦");
      expect(newYear).toBeDefined();
    });

    it("应该支持按标签筛选（OR 匹配）", () => {
      const list = repo.list({ tags: ["节日", "旅行"] });
      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it("应该支持按人物筛选", () => {
      const list = repo.list({ people: ["爱人"] });
      const valentine = list.find((d) => d.content === "情人节");
      expect(valentine).toBeDefined();
    });

    it("应该支持按地点筛选", () => {
      const list = repo.list({ locations: ["巴黎"] });
      const travel = list.find((d) => d.content === "某天");
      expect(travel).toBeDefined();
    });

    it("应该支持多个条件组合", () => {
      const list = repo.list({
        startDate: "2024-02-01",
        tags: ["浪漫"],
      });
      const valentine = list.find((d) => d.content === "情人节");
      expect(valentine).toBeDefined();
    });

    it("应该支持 limit 限制", () => {
      const list = repo.list({ limit: 2 });
      expect(list.length).toBeLessThanOrEqual(2);
    });

    it("不匹配的条件应该返回空数组", () => {
      const list = repo.list({ tags: ["不存在的标签xyz123"] });
      expect(list).toHaveLength(0);
    });
  });

  describe("update", () => {
    it("应该更新日记内容", () => {
      const id = repo.save({ content: "原始内容" });
      const success = repo.update(id, { content: "新内容" });
      expect(success).toBe(true);
      const updated = repo.findById(id);
      expect(updated?.content).toBe("新内容");
    });

    it("应该更新 eventDate", () => {
      const id = repo.save({ content: "测试" });
      const success = repo.update(id, { eventDate: "2024-12-25" });
      expect(success).toBe(true);
      const updated = repo.findById(id);
      expect(updated?.eventDate).toBe("2024-12-25");
    });

    it("应该更新数组字段", () => {
      const id = repo.save({
        content: "测试",
        people: ["张三"],
      });
      const success = repo.update(id, {
        people: ["李四", "王五"],
        tags: ["更新"],
      });
      expect(success).toBe(true);
      const updated = repo.findById(id);
      expect(updated?.people).toEqual(["李四", "王五"]);
      expect(updated?.tags).toEqual(["更新"]);
    });

    it("应该更新 updated_at 时间戳", () => {
      const id = repo.save({ content: "测试" });
      const original = repo.findById(id);
      // 等待 1ms 确保时间戳不同
      const startTime = Date.now();
      while (Date.now() - startTime < 2) {
        // busy wait
      }
      repo.update(id, { content: "更新" });
      const updated = repo.findById(id);
      expect(updated?.updatedAt).not.toBe(original?.updatedAt);
    });

    it("更新不存在的 ID 应该返回 false", () => {
      const success = repo.update("non-existent-id", { content: "测试" });
      expect(success).toBe(false);
    });

    it("应该支持部分更新", () => {
      const id = repo.save({
        content: "测试",
        eventDate: "2024-01-01",
        tags: ["原始"],
      });
      repo.update(id, { content: "新内容" });
      const updated = repo.findById(id);
      expect(updated?.content).toBe("新内容");
      expect(updated?.eventDate).toBe("2024-01-01"); // 未改变
      expect(updated?.tags).toEqual(["原始"]); // 未改变
    });
  });

  describe("delete", () => {
    it("应该删除日记", () => {
      const id = repo.save({ content: "测试" });
      expect(repo.findById(id)).toBeDefined();
      const success = repo.delete(id);
      expect(success).toBe(true);
      expect(repo.findById(id)).toBeNull();
    });

    it("删除不存在的 ID 应该返回 false", () => {
      const success = repo.delete("non-existent-id");
      expect(success).toBe(false);
    });

    it("删除后不应影响其他日记", () => {
      const id1 = repo.save({ content: "日记1" });
      const id2 = repo.save({ content: "日记2" });
      repo.delete(id1);
      expect(repo.findById(id1)).toBeNull();
      expect(repo.findById(id2)).toBeDefined();
    });
  });
});
