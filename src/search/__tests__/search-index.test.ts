/**
 * search-index 工具函数测试
 * 测试 FTS5 索引创建、同步、重建功能
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, closeDatabase, getDb } from "../../storage/database";
import { rebuildSearchIndex, searchIndexExists, getSearchIndexCount, isFTSAvailable } from "../search-index";
import { DiaryRepository } from "../../storage/diary-repository";

describe("search-index", () => {
  beforeEach(() => {
    process.env.DATABASE_PATH = ":memory:";
    initDatabase(":memory:");
  });

  afterEach(() => {
    closeDatabase();
  });

  describe("isFTSAvailable", () => {
    it("应该检测到 FTS5 是否可用", () => {
      const available = isFTSAvailable();
      expect(typeof available).toBe("boolean");
    });

    it("应该返回布尔值表示 FTS5 可用性", () => {
      // FTS5 可用性取决于 SQLite 编译版本
      const available = isFTSAvailable();
      expect(typeof available === "boolean").toBe(true);
    });
  });

  describe("searchIndexExists", () => {
    it("应该检测到 FTS 索引表是否存在", () => {
      const exists = searchIndexExists();
      expect(exists).toBe(true);
    });
  });

  describe("getSearchIndexCount", () => {
    it("初始索引计数应该与主表一致", () => {
      const db = getDb();

      // 清空主表
      db.exec("DELETE FROM diaries");

      const count = getSearchIndexCount();
      expect(count).toBe(0);
    });

    it("插入日记后索引计数应该增加", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");

      diaryRepo.save({
        content: "测试日记",
        tags: ["测试"],
      });

      // 等待触发器同步
      const count = getSearchIndexCount();
      expect(count).toBe(1);
    });

    it("删除日记后索引计数应该减少", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");
      db.exec("DELETE FROM diaries_fts");

      const diaryId = diaryRepo.save({
        content: "测试日记",
        tags: ["测试"],
      });

      const beforeCount = getSearchIndexCount();
      expect(beforeCount).toBe(1);

      diaryRepo.delete(diaryId);

      const afterCount = getSearchIndexCount();
      expect(afterCount).toBe(0);
    });
  });

  describe("rebuildSearchIndex", () => {
    it("应该能成功重建索引", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");

      // 插入测试数据
      for (let i = 0; i < 5; i++) {
        diaryRepo.save({
          content: `日记 ${i}`,
          tags: ["测试"],
        });
      }

      // 重建索引不应该抛出错误
      expect(() => rebuildSearchIndex()).not.toThrow();

      // 重建后索引计数应该正确
      const count = getSearchIndexCount();
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it("重建后索引应该与主表保持同步", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");
      db.exec("DELETE FROM diaries_fts");

      diaryRepo.save({
        content: "测试日记",
        tags: ["测试"],
      });

      // 重建索引
      rebuildSearchIndex();

      // 验证索引计数正确
      expect(getSearchIndexCount()).toBeGreaterThanOrEqual(1);

      // 再插入一条
      diaryRepo.save({
        content: "第二篇日记",
        tags: ["测试"],
      });

      // 索引应该自动同步
      expect(getSearchIndexCount()).toBeGreaterThanOrEqual(2);
    });

    it("重建空索引不应该报错", () => {
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");
      db.exec("DELETE FROM diaries_fts");

      expect(() => rebuildSearchIndex()).not.toThrow();
    });
  });

  describe("索引同步触发器", () => {
    it("INSERT 触发器应该自动同步到 FTS 索引", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");
      db.exec("DELETE FROM diaries_fts");

      const beforeCount = getSearchIndexCount();
      expect(beforeCount).toBe(0);

      diaryRepo.save({
        content: "新日记",
        tags: ["新"],
      });

      const afterCount = getSearchIndexCount();
      expect(afterCount).toBeGreaterThanOrEqual(1);
    });

    it("UPDATE 触发器应该自动同步到 FTS 索引", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");
      db.exec("DELETE FROM diaries_fts");

      const diaryId = diaryRepo.save({
        content: "原始内容",
        tags: ["原始"],
      });

      expect(getSearchIndexCount()).toBeGreaterThanOrEqual(1);

      // 更新日记
      diaryRepo.update(diaryId, {
        content: "更新后的内容",
        tags: ["更新"],
      });

      // 索引计数应该仍然 >= 1
      expect(getSearchIndexCount()).toBeGreaterThanOrEqual(1);
    });

    it("DELETE 触发器应该自动从 FTS 索引删除", () => {
      const diaryRepo = new DiaryRepository();
      const db = getDb();

      // 清空现有数据
      db.exec("DELETE FROM diaries");
      db.exec("DELETE FROM diaries_fts");

      const diaryId = diaryRepo.save({
        content: "待删除",
        tags: ["删除"],
      });

      const beforeCount = getSearchIndexCount();
      expect(beforeCount).toBe(1);

      diaryRepo.delete(diaryId);

      const afterCount = getSearchIndexCount();
      expect(afterCount).toBe(0);
    });
  });
});
