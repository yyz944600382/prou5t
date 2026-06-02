/**
 * 数据库初始化测试
 */

import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync } from "node:fs";
import { initDatabase, closeDatabase, getDb } from "../database";

describe("database", () => {
  afterEach(() => {
    // 清理测试数据库
    closeDatabase();
    if (existsSync("test-data")) {
      try {
        rmSync("test-data", { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  });

  describe("initDatabase", () => {
    it("应该创建数据目录", () => {
      initDatabase("test-data");
      expect(existsSync("test-data")).toBe(true);
    });

    it("应该创建数据库文件", () => {
      initDatabase("test-data");
      expect(existsSync("test-data/prou5t.db")).toBe(true);
    });

    it("多次调用不应该重复创建", () => {
      initDatabase("test-data");
      const db1 = getDb();
      initDatabase("test-data");
      const db2 = getDb();
      expect(db1).toBe(db2); // 同一个实例
    });

    it("应该创建 diaries 表", () => {
      initDatabase("test-data");
      const db = getDb();
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='diaries'",
        )
        .all() as { name: string }[];
      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe("diaries");
    });

    it("应该创建索引", () => {
      initDatabase("test-data");
      const db = getDb();
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='diaries'",
        )
        .all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_diaries_event_date");
      expect(indexNames).toContain("idx_diaries_created_at");
    });
  });

  describe("getDb", () => {
    it("未初始化时应该抛出错误", () => {
      closeDatabase(); // 确保已关闭
      expect(() => getDb()).toThrow("Database not initialized");
    });

    it("初始化后应该返回数据库实例", () => {
      initDatabase("test-data");
      const db = getDb();
      expect(db).toBeDefined();
      expect(db.constructor.name).toBe("Database");
    });
  });

  describe("closeDatabase", () => {
    it("应该关闭数据库连接", () => {
      initDatabase("test-data");
      const db = getDb();
      closeDatabase();
      // 连接关闭后，open 属性为 false
      expect(db.open).toBe(false);
    });

    it("关闭后可以重新初始化", () => {
      initDatabase("test-data");
      closeDatabase();
      initDatabase("test-data");
      const db = getDb();
      expect(db).toBeDefined();
    });
  });
});
