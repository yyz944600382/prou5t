/**
 * DiaryExtractHook 测试（真实 API + 真实数据库，UI mock 是必需的）
 *
 * 注意：UI (@clack/prompts) 必须保持 mock，因为无法在测试环境中自动化交互。
 * 但 LLM 调用和数据库操作使用真实实现。
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { DiaryExtractHook } from "../diary-extract";
import type { SessionContext } from "../../agent/types";
import { DiaryRepository } from "../../storage/diary-repository";
import { initDatabase, closeDatabase } from "../../storage/database";
import { createAdapter, type AdapterConfig } from "../../adapters";
import { DiaryExtractor } from "../../diary/extractor";
import * as DiaryUI from "../../diary/ui";
import { existsSync, rmSync } from "node:fs";

const TEST_DATA_DIR = "test-data-hook";

// UI mock 是必需的（无法在测试环境中自动化终端交互）
vi.mock("../../diary/ui", () => ({
  confirmExtraction: vi.fn().mockResolvedValue({ action: "skip" }),
}));

describe("DiaryExtractHook（真实 API + 真实数据库）", { timeout: 120000 }, () => {
  let hook: DiaryExtractHook;
  let repository: DiaryRepository;
  let ctx: SessionContext;
  let config: AdapterConfig;

  beforeAll(() => {
    // 从环境变量读取配置
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      throw new Error("DEEPSEEK_API_KEY 环境变量未设置");
    }

    config = {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY || "test-key",
      openaiApiKey: process.env.OPENAI_API_KEY || "test-key",
      deepseekApiKey,
    };

    // 创建真实适配器
    const adapter = createAdapter("deepseek", config);

    // 创建 hook 实例（使用真实适配器）
    hook = new DiaryExtractHook({ adapter });
  });

  beforeEach(() => {
    // 每个测试前清理并重新初始化数据库
    closeDatabase();
    if (existsSync(TEST_DATA_DIR)) {
      try {
        rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
    initDatabase(TEST_DATA_DIR);
    repository = new DiaryRepository();
    ctx = {} as SessionContext;
    vi.clearAllMocks();
  });

  afterAll(() => {
    closeDatabase();
    if (existsSync(TEST_DATA_DIR)) {
      try {
        rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      } catch {
        // 忽略清理错误
      }
    }
  });

  describe("基础流程", () => {
    it("短消息不应该触发提取", async () => {
      await hook.afterUserMessage(ctx, "短消息");
      // 验证：检查数据库没有新增日记
      const diaries = repository.list();
      expect(diaries.length).toBe(0);
    });

    it("三条回忆消息应该触发提取", { timeout: 60000 }, async () => {
      // Mock UI 返回跳过（避免真实交互）
      vi.mocked(DiaryUI.confirmExtraction).mockResolvedValue({
        action: "skip",
      });

      // 用真实的回忆内容，这样 isRecall 才会返回 true
      await hook.afterUserMessage(ctx, "去年夏天我和朋友去了海边");
      await hook.afterUserMessage(ctx, "那天天气特别好，阳光很刺眼");
      await hook.afterUserMessage(ctx, "我们在沙滩上玩了一整天，晚上还吃了海鲜大餐");

      // 等待异步操作完成（真实 API 需要时间）
      await new Promise((resolve) => setTimeout(resolve, 15000));

      // UI 应该被调用（因为触发了提取）
      expect(DiaryUI.confirmExtraction).toHaveBeenCalled();
    });
  });

  describe("数据库操作验证", () => {
    it("应该能保存日记到真实数据库", async () => {
      // 直接测试数据库操作
      const diaryId = repository.save({
        content: "测试日记",
        eventDate: "2024-06-02",
      });

      expect(diaryId).toBeDefined();
      expect(typeof diaryId).toBe("string");

      // 验证可以查询
      const found = repository.findById(diaryId);
      expect(found).not.toBeNull();
      expect(found?.content).toBe("测试日记");
      expect(found?.eventDate).toBe("2024-06-02");
    });

    it("应该能按条件查询日记", async () => {
      // 保存测试数据
      repository.save({
        content: "旅行日记",
        tags: ["旅行"],
        eventDate: "2024-01-01",
      });

      repository.save({
        content: "美食日记",
        tags: ["美食"],
        eventDate: "2024-02-01",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 按标签查询
      const travelDiaries = repository.list({ tags: ["旅行"] });
      const foodDiaries = repository.list({ tags: ["美食"] });

      expect(travelDiaries.length).toBeGreaterThanOrEqual(1);
      expect(foodDiaries.length).toBeGreaterThanOrEqual(1);
    });

    it("应该能更新日记", async () => {
      const id = repository.save({
        content: "原始内容",
        eventDate: "2024-01-01",
      });

      const success = repository.update(id, { content: "更新内容" });
      expect(success).toBe(true);

      const updated = repository.findById(id);
      expect(updated?.content).toBe("更新内容");
    });

    it("应该能删除日记", async () => {
      const id = repository.save({
        content: "待删除",
        eventDate: "2024-01-01",
      });

      const success = repository.delete(id);
      expect(success).toBe(true);

      const deleted = repository.findById(id);
      expect(deleted).toBeNull();
    });
  });

  describe("错误处理", () => {
    it("更新不存在的日记应该返回 false", () => {
      const success = repository.update("non-existent-id", { content: "测试" });
      expect(success).toBe(false);
    });

    it("删除不存在的日记应该返回 false", () => {
      const success = repository.delete("non-existent-id");
      expect(success).toBe(false);
    });

    it("应该处理空的数组字段", () => {
      const id = repository.save({
        content: "测试",
        people: [],
        locations: [],
        emotions: [],
        tags: [],
      });

      const found = repository.findById(id);
      expect(found).not.toBeNull();
      expect(found?.people).toEqual([]);
      expect(found?.locations).toEqual([]);
    });
  });

  describe("消息累积逻辑", () => {
    it("应该正确计算消息累积", () => {
      const adapter = createAdapter("deepseek", config);
      const extractor = new DiaryExtractor(adapter);

      // 测试累积逻辑
      const result1 = extractor.accumulate("消息1", []);
      expect(result1.accumulated).toEqual(["消息1"]);
      expect(result1.ready).toBe(false);

      const result2 = extractor.accumulate("消息2", result1.accumulated);
      expect(result2.accumulated).toEqual(["消息1", "消息2"]);
      expect(result2.ready).toBe(false);

      const result3 = extractor.accumulate("消息3", result2.accumulated);
      expect(result3.accumulated).toEqual(["消息1", "消息2", "消息3"]);
      expect(result3.ready).toBe(true); // 3 条消息触发
    });

    it("应该按长度触发提取", () => {
      const adapter = createAdapter("deepseek", config);
      const extractor = new DiaryExtractor(adapter);

      const longMessage = "A".repeat(201);
      const result = extractor.accumulate(longMessage, []);
      expect(result.ready).toBe(true);
    });
  });
});
