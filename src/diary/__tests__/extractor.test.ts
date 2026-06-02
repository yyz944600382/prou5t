/**
 * DiaryExtractor 测试（真实 API 调用，禁止 mock）
 */

import { describe, it, expect, beforeAll } from "vitest";
import { DiaryExtractor } from "../extractor";
import { createAdapter, type AdapterConfig } from "../../adapters";

describe("DiaryExtractor（真实 API）", { timeout: 120000 }, () => {
  let extractor: DiaryExtractor;
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

    const adapter = createAdapter("deepseek", config);
    extractor = new DiaryExtractor(adapter);
  });

  describe("isRecall", () => {
    it("空消息应该返回非回忆", async () => {
      const result = await extractor.isRecall([]);
      expect(result).toEqual({
        isRecall: false,
        reason: "无消息内容",
        confidence: 1,
      });
    });

    it("应该识别回忆性内容", { timeout: 30000 }, async () => {
      const result = await extractor.isRecall([
        "那年夏天，我和朋友们一起去海边旅行",
        "我们住了三天两夜，每天晚上都在沙滩上烧烤聊天",
      ]);

      expect(result.isRecall).toBe(true);
      expect(result.reason).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.7);
      console.log("回忆识别结果:", result);
    });

    it("应该识别非回忆性内容", { timeout: 30000 }, async () => {
      const result = await extractor.isRecall(["今天中午吃了牛肉面", "味道还不错"]);

      expect(result.isRecall).toBe(false);
      console.log("非回忆识别结果:", result);
    });
  });

  describe("extract", () => {
    it("空消息应该抛出错误", async () => {
      await expect(extractor.extract([])).rejects.toThrow(
        "无法从空消息中提取日记",
      );
    });

    it("应该提取日记结构化数据", { timeout: 30000 }, async () => {
      const result = await extractor.extract([
        "大三那年暑假，我和室友们一起去了黄山旅游",
        "我们凌晨三点起床看日出，站在光明顶上看着太阳慢慢升起",
        "那一刻我觉得所有的辛苦都值得了",
      ]);

      expect(result.content).toBeDefined();
      expect(typeof result.content).toBe("string");
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.people).toBeDefined();
      expect(Array.isArray(result.people)).toBe(true);
      expect(result.locations).toBeDefined();
      expect(Array.isArray(result.locations)).toBe(true);
      expect(result.emotions).toBeDefined();
      expect(Array.isArray(result.emotions)).toBe(true);
      expect(result.tags).toBeDefined();
      expect(Array.isArray(result.tags)).toBe(true);

      console.log("日记提取结果:", {
        content: result.content.substring(0, 100) + "...",
        eventDate: result.eventDate,
        people: result.people,
        locations: result.locations,
        emotions: result.emotions,
        tags: result.tags,
      });
    });

    it("应该允许 eventDate 为 null", { timeout: 30000 }, async () => {
      const result = await extractor.extract([
        "有一次我和朋友出去玩，具体时间记不清了",
      ]);

      expect(result.content).toBeDefined();
      // eventDate 可能是 null 或推断的日期
      console.log("无日期提取结果:", result);
    });
  });

  describe("accumulate", () => {
    it("应该累积消息到缓冲", () => {
      const result = extractor.accumulate("新消息", ["旧消息"]);
      expect(result.accumulated).toEqual(["旧消息", "新消息"]);
    });

    it("空缓冲时应该累积单条消息", () => {
      const result = extractor.accumulate("第一条消息", []);
      expect(result.accumulated).toEqual(["第一条消息"]);
    });

    it("总长度 > 200 字符时应该触发 ready", () => {
      const longMessage = "A".repeat(201);
      const result = extractor.accumulate(longMessage, []);
      expect(result.ready).toBe(true);
    });

    it("消息数 >= 3 时应该触发 ready", () => {
      const result = extractor.accumulate("第三条", ["第一条", "第二条"]);
      expect(result.ready).toBe(true);
    });

    it("不满足条件时不应触发 ready", () => {
      const result = extractor.accumulate("第二条", ["第一条"]);
      expect(result.ready).toBe(false);
    });
  });

  describe("toDiaryEntry", () => {
    it("应该转换完整的提取结果", () => {
      const extraction = {
        eventDate: "2024-03-15",
        content: "测试日记",
        people: ["张三"],
        locations: ["北京"],
        emotions: ["开心"],
        tags: ["旅行"],
      };

      const entry = extractor.toDiaryEntry(extraction);
      expect(entry.eventDate).toBe("2024-03-15");
      expect(entry.content).toBe("测试日记");
      expect(entry.people).toEqual(["张三"]);
      expect(entry.locations).toEqual(["北京"]);
      expect(entry.emotions).toEqual(["开心"]);
      expect(entry.tags).toEqual(["旅行"]);
      expect(entry.id).toBeUndefined();
      expect(entry.createdAt).toBeDefined();
    });

    it("应该生成 createdAt 时间戳", () => {
      const before = new Date().toISOString();
      const entry = extractor.toDiaryEntry({
        eventDate: null,
        content: "测试",
        people: [],
        locations: [],
        emotions: [],
        tags: [],
      });
      const after = new Date().toISOString();
      expect(entry.createdAt).toBeDefined();
      expect(entry.createdAt >= before && entry.createdAt <= after).toBe(true);
    });

    it("eventDate 为 null 应该转换为 undefined", () => {
      const entry = extractor.toDiaryEntry({
        eventDate: null,
        content: "测试",
        people: [],
        locations: [],
        emotions: [],
        tags: [],
      });
      expect(entry.eventDate).toBeUndefined();
    });

    it("空数组字段应该转换为 undefined", () => {
      const entry = extractor.toDiaryEntry({
        eventDate: null,
        content: "测试",
        people: [],
        locations: [],
        emotions: [],
        tags: [],
      });
      expect(entry.people).toBeUndefined();
      expect(entry.locations).toBeUndefined();
      expect(entry.emotions).toBeUndefined();
      expect(entry.tags).toBeUndefined();
    });

    it("非空数组应该保留", () => {
      const entry = extractor.toDiaryEntry({
        eventDate: null,
        content: "测试",
        people: ["张三"],
        locations: [],
        emotions: ["开心"],
        tags: [],
      });
      expect(entry.people).toEqual(["张三"]);
      expect(entry.emotions).toEqual(["开心"]);
      expect(entry.locations).toBeUndefined();
      expect(entry.tags).toBeUndefined();
    });
  });
});
