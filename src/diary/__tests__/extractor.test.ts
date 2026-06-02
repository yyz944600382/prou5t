/**
 * DiaryExtractor 测试
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DiaryExtractor } from "../extractor";
import type { LLMAdapter } from "../../adapters/base";
import type { LLMResponse } from "../../adapters/base";

describe("DiaryExtractor", () => {
  let mockAdapter: LLMAdapter;
  let extractor: DiaryExtractor;

  beforeEach(() => {
    // 创建 mock adapter
    mockAdapter = {
      name: "mock-adapter",
      chat: vi.fn(),
      chatWithTools: vi.fn(),
    };
    extractor = new DiaryExtractor(mockAdapter);
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

    it("应该识别回忆性内容（JSON 格式）", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "isRecall": true,
  "reason": "用户讲述过去的事情",
  "confidence": 0.9
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.isRecall(["那年夏天", "我们一起去旅行"]);
      expect(result.isRecall).toBe(true);
      expect(result.reason).toBe("用户讲述过去的事情");
      expect(result.confidence).toBe(0.9);
    });

    it("应该识别回忆性内容（markdown JSON 格式）", async () => {
      const mockResponse: LLMResponse = {
        content: `\`\`\`json
{
  "isRecall": true,
  "reason": "提到去年冬天",
  "confidence": 0.85
}
\`\`\``,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.isRecall(["去年冬天", "下了一场大雪"]);
      expect(result.isRecall).toBe(true);
      expect(result.reason).toBe("提到去年冬天");
      expect(result.confidence).toBe(0.85);
    });

    it("应该识别非回忆性内容", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "isRecall": false,
  "reason": "当天日常事务",
  "confidence": 0.95
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.isRecall(["今天中午", "吃了牛肉面"]);
      expect(result.isRecall).toBe(false);
      expect(result.reason).toContain("日常");
    });

    it("LLM 错误时应该优雅降级返回非回忆", async () => {
      vi.mocked(mockAdapter.chat).mockRejectedValue(new Error("API error"));

      const result = await extractor.isRecall(["测试消息"]);
      expect(result).toEqual({
        isRecall: false,
        reason: "识别失败",
        confidence: 0,
      });
    });

    it("应该正确传递 prompt", async () => {
      const mockResponse: LLMResponse = {
        content: `{"isRecall": true, "reason": "test", "confidence": 0.8}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      await extractor.isRecall(["消息1", "消息2"]);
      expect(mockAdapter.chat).toHaveBeenCalledWith(
        [],
        expect.stringContaining("消息1\n消息2"),
      );
    });
  });

  describe("extract", () => {
    it("空消息应该抛出错误", async () => {
      await expect(extractor.extract([])).rejects.toThrow(
        "无法从空消息中提取日记",
      );
    });

    it("应该提取日记（JSON 格式）", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "eventDate": "2024-03-15",
  "content": "今天和朋友们去了海边",
  "people": ["张三", "李四"],
  "locations": ["海滩"],
  "emotions": ["开心"],
  "tags": ["聚会", "户外"]
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.extract(["今天和朋友们去了海边"]);
      expect(result.eventDate).toBe("2024-03-15");
      expect(result.content).toBe("今天和朋友们去了海边");
      expect(result.people).toEqual(["张三", "李四"]);
      expect(result.locations).toEqual(["海滩"]);
      expect(result.emotions).toEqual(["开心"]);
      expect(result.tags).toEqual(["聚会", "户外"]);
    });

    it("应该提取日记（markdown JSON 格式）", async () => {
      const mockResponse: LLMResponse = {
        content: `\`\`\`json
{
  "eventDate": "2023-12-25",
  "content": "圣诞节家庭聚会",
  "people": ["爸爸", "妈妈"],
  "locations": ["家"],
  "emotions": ["温馨"],
  "tags": ["节日"]
}
\`\`\``,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.extract(["圣诞节家庭聚会"]);
      expect(result.eventDate).toBe("2023-12-25");
      expect(result.content).toBe("圣诞节家庭聚会");
    });

    it("应该允许 eventDate 为 null", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "eventDate": null,
  "content": "某次难忘的经历",
  "people": [],
  "locations": [],
  "emotions": [],
  "tags": []
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.extract(["某次难忘的经历"]);
      expect(result.eventDate).toBeNull();
      expect(result.content).toBe("某次难忘的经历");
    });

    it("应该填充缺失的数组字段为空数组", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "eventDate": "2024-01-01",
  "content": "测试内容"
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      const result = await extractor.extract(["测试"]);
      expect(result.people).toEqual([]);
      expect(result.locations).toEqual([]);
      expect(result.emotions).toEqual([]);
      expect(result.tags).toEqual([]);
    });

    it("缺少 content 字段应该抛出错误", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "eventDate": "2024-01-01"
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      await expect(extractor.extract(["测试"])).rejects.toThrow(
        "提取结果缺少 content 字段",
      );
    });

    it("content 字段不是字符串应该抛出错误", async () => {
      const mockResponse: LLMResponse = {
        content: `{
  "eventDate": "2024-01-01",
  "content": 123
}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      await expect(extractor.extract(["测试"])).rejects.toThrow(
        "提取结果缺少 content 字段",
      );
    });

    it("LLM 错误应该抛出错误", async () => {
      vi.mocked(mockAdapter.chat).mockRejectedValue(new Error("API error"));

      await expect(extractor.extract(["测试"])).rejects.toThrow("API error");
    });

    it("应该正确传递 prompt", async () => {
      const mockResponse: LLMResponse = {
        content: `{"eventDate": null, "content": "test", "people": [], "locations": [], "emotions": [], "tags": []}`,
      };
      vi.mocked(mockAdapter.chat).mockResolvedValue(mockResponse);

      await extractor.extract(["消息A", "消息B"]);
      expect(mockAdapter.chat).toHaveBeenCalledWith(
        [],
        expect.stringContaining("消息A\n消息B"),
      );
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

    it("短消息 + 少量不应触发 ready", () => {
      const result = extractor.accumulate("hi", []);
      expect(result.ready).toBe(false);
    });

    it("应该正确计算总长度（多消息）", () => {
      const longMsg1 = "A".repeat(80);
      const longMsg2 = "B".repeat(80);
      const longMsg3 = "C".repeat(80);
      const result = extractor.accumulate(longMsg3, [longMsg1, longMsg2]);
      const totalLength = result.accumulated.join("").length;
      expect(totalLength).toBeGreaterThan(200);
      expect(result.ready).toBe(true);
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
      // id is not present on Omit<DiaryEntry, "id">
      expect((entry as Record<string, unknown>)['id']).toBeUndefined();
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
